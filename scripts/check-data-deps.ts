#!/usr/bin/env node
/**
 * Static analysis: find data-store properties written by put* calls
 * but never read by any get* call. Run from the repo root.
 *
 * Add entries to STORES to cover new stores.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { parse } from 'acorn';
import { transformSync } from 'esbuild';

const ROOT = new URL('..', import.meta.url).pathname;
const HOME = join(ROOT, 'home');

// hostnames is an array, not a keyed object — skip it.
// `groups` names sub-objects that hold conditionally-booted fields (see
// General-Design "Data Stores"). Their keys are tracked as first-class store
// fields: writes descend one level into them, and a binding pulled out of a
// group is treated as a store alias so `group.field` reads are detected.
const STORES = {
  staticData: {
    get: 'getStaticData',
    put: 'putStaticData',
    groups: ['singularityData', 'graftingData'],
  },
  playerData: { get: 'getPlayerData', put: 'putPlayerData', groups: [] as string[] },
  moneyData: { get: 'getMoneyData', put: 'putMoneyData', groups: [] as string[] },
};

// ── AST helpers ───────────────────────────────────────────────────────────────

// Runtime artifacts, not source.
const SKIP_DIRS = new Set(['log', 'tmp']);

function getAllSourceFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) result.push(...getAllSourceFiles(full));
    } else if (entry.name.endsWith('.ts')) result.push(full);
  }
  return result;
}

/** Strip TypeScript annotations so acorn can parse the result. */
function toAst(src: string) {
  const js = transformSync(src, { loader: 'ts', format: 'esm', target: 'esnext' }).code;
  return parse(js, { ecmaVersion: 2022, sourceType: 'module' });
}

/** Visit every AST node depth-first. */
function walk(node: any, fn: (node: any) => void): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, fn));
    return;
  }
  if (typeof node.type === 'string') fn(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    walk(node[key], fn);
  }
}

/**
 * True if `node` is a direct call `funcName(<identifier>, ...)`.
 *
 * The first argument is not required to be named `ns`: esbuild renames shadowed
 * bindings, so a nested `(ns) => …` becomes `ns2` in the parsed output. Matching
 * the literal name silently hid every store access in such a file — both reads
 * and writes. Store accessors take a single NS argument, so any identifier here
 * is unambiguous.
 */
function isCallTo(node: any, funcName: string): boolean {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === funcName &&
    node.arguments?.[0]?.type === 'Identifier'
  );
}

/**
 * True if `node` is an expression whose value comes from a direct call to
 * `getFn(ns)`. Handles `getFn(ns) || {}` and `getFn(ns) ?? {}` fallbacks.
 */
function isStoreInit(node: any, getFn: string): boolean {
  if (!node) return false;
  if (isCallTo(node, getFn)) return true;
  if (node.type === 'LogicalExpression')
    return isStoreInit(node.left, getFn) || isStoreInit(node.right, getFn);
  return false;
}

/** Extract property keys from an ObjectExpression or ObjectPattern node. */
function keysOf(node: any): Set<string> {
  const keys = new Set<string>();
  for (const prop of node?.properties ?? []) {
    if (prop.type === 'SpreadElement' || prop.type === 'RestElement') continue;
    if (prop.key?.type === 'Identifier') keys.add(prop.key.name);
    else if (prop.key?.type === 'Literal') keys.add(String(prop.key.value));
  }
  return keys;
}

// ── Per-file analysis ─────────────────────────────────────────────────────────

function analyzeFile(ast: any, getFn: string, putFn: string, groupKeys: string[] = []) {
  const groups = new Set(groupKeys);
  const written = new Set<string>();
  const read = new Set<string>();
  const warnings = new Set<string>();

  // Pass 1: collect written keys and variable aliases for the store.
  const aliases = new Set<string>(); // names of variables assigned directly from getFn(ns)

  walk(ast, (node) => {
    // putFn(ns, { k: v, k2 }) — record every property key, descending into groups
    if (isCallTo(node, putFn) && node.arguments[1]?.type === 'ObjectExpression') {
      for (const k of keysOf(node.arguments[1])) written.add(k);
      for (const prop of node.arguments[1].properties ?? []) {
        const key = prop.key?.name ?? prop.key?.value;
        if (groups.has(key) && prop.value?.type === 'ObjectExpression')
          for (const k of keysOf(prop.value)) written.add(k);
      }
    }

    if (node.type !== 'VariableDeclarator') return;

    // const { k } = getFn(ns) [or getFn(ns) || {}]
    if (node.id?.type === 'ObjectPattern' && isStoreInit(node.init, getFn)) {
      for (const k of keysOf(node.id)) read.add(k);
      // A group destructured out of the store behaves like a second alias:
      // `const { singularityData } = getStaticData(ns)` then `singularityData.foo`.
      for (const prop of node.id.properties ?? []) {
        const key = prop.key?.name ?? prop.key?.value;
        if (groups.has(key) && prop.value?.type === 'Identifier') aliases.add(prop.value.name);
      }
    }

    // const g = getFn(ns).<group>  — also an alias
    if (
      node.id?.type === 'Identifier' &&
      node.init?.type === 'MemberExpression' &&
      isStoreInit(node.init.object, getFn) &&
      groups.has(node.init.property?.name)
    )
      aliases.add(node.id.name);

    // const alias = getFn(ns) [or getFn(ns) || {}]
    // Excludes: const x = getFn(ns).key  (init is MemberExpression, not a store init)
    if (node.id?.type === 'Identifier' && isStoreInit(node.init, getFn)) aliases.add(node.id.name);
  });

  // Pass 2: find reads via aliases and direct chained access.
  walk(ast, (node) => {
    // getFn(ns).key  or  getFn(ns)?.key
    if (
      node.type === 'MemberExpression' &&
      isCallTo(node.object, getFn) &&
      node.property?.type === 'Identifier'
    )
      read.add(node.property.name);

    // <anything>.<group>.key  and  const { k } = <anything>.<group>
    //
    // Deliberately not rooted at getFn or a known alias: group names are unique
    // to this store, and since the SF4StaticData refactor most nested reads happen
    // through a *parameter* (`staticData: SF4StaticData`), which alias tracking
    // cannot follow. Matching on the group name recovers those.
    if (
      node.type === 'MemberExpression' &&
      node.object?.type === 'MemberExpression' &&
      groups.has(node.object.property?.name) &&
      node.property?.type === 'Identifier'
    )
      read.add(node.property.name);

    if (
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'ObjectPattern' &&
      node.init?.type === 'MemberExpression' &&
      groups.has(node.init.property?.name)
    )
      for (const k of keysOf(node.id)) read.add(k);

    for (const alias of aliases) {
      // alias.key  or  alias?.key
      if (
        node.type === 'MemberExpression' &&
        node.object?.type === 'Identifier' &&
        node.object.name === alias &&
        node.property?.type === 'Identifier'
      )
        read.add(node.property.name);

      // const { k } = alias
      if (
        node.type === 'VariableDeclarator' &&
        node.id?.type === 'ObjectPattern' &&
        node.init?.type === 'Identifier' &&
        node.init.name === alias
      )
        for (const k of keysOf(node.id)) read.add(k);

      // alias passed as a direct argument to an unknown function
      // (not getFn/putFn, not as alias.prop — that's caught above as a read)
      if (node.type === 'CallExpression') {
        const callee = node.callee?.type === 'Identifier' ? node.callee.name : '(expression)';
        if (callee === getFn || callee === putFn) continue;
        for (const arg of node.arguments) {
          if (arg.type === 'Identifier' && arg.name === alias)
            warnings.add(
              `'${alias}' (alias of ${getFn}) passed as argument to '${callee}' ` +
                `— reads inside that function are not detected`,
            );
        }
      }
    }
  });

  return { written, read, warnings };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const files = getAllSourceFiles(HOME);
if (files.length === 0) {
  console.error(`No .ts files found under ${HOME}. Nothing was analyzed.`);
  process.exit(1);
}
const stats: Record<
  string,
  {
    written: Map<string, string[]>;
    read: Map<string, string[]>;
    warnings: string[];
  }
> = Object.fromEntries(
  Object.keys(STORES).map((s) => [
    s,
    {
      written: new Map<string, string[]>(),
      read: new Map<string, string[]>(),
      warnings: [] as string[],
    },
  ]),
);

const parseFailures: string[] = [];

for (const file of files) {
  const rel = relative(HOME, file);

  let ast;
  try {
    ast = toAst(readFileSync(file, 'utf-8'));
  } catch (error) {
    // A file we cannot parse is a file we cannot vouch for. Report it rather
    // than silently treating it as having no reads or writes.
    parseFailures.push(`    ${rel}: ${error instanceof Error ? error.message : error}`);
    continue;
  }

  for (const [store, { get, put, groups }] of Object.entries(STORES)) {
    const s = stats[store];
    const { written, read, warnings } = analyzeFile(ast, get, put, groups);

    for (const k of written) {
      if (!s.written.has(k)) s.written.set(k, []);
      s.written.get(k)!.push(rel);
    }
    for (const k of read) {
      if (!s.read.has(k)) s.read.set(k, []);
      s.read.get(k)!.push(rel);
    }
    for (const w of warnings) s.warnings.push(`    ${rel}: ${w}`);
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

let anyOutput = false;
for (const [store, { written, read, warnings }] of Object.entries(stats)) {
  const orphaned = [...written.keys()].filter((k) => !read.has(k)).sort();
  if (orphaned.length === 0 && warnings.length === 0) continue;

  anyOutput = true;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${store}`);
  console.log('─'.repeat(60));

  if (orphaned.length > 0) {
    console.log('\n  Written but never read:');
    for (const k of orphaned) {
      console.log(`\n    ${k}`);
      for (const f of written.get(k)!) console.log(`      ← ${f}`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n  Warnings (some reads may not be detected):');
    for (const w of warnings) console.log(w);
  }
}

if (parseFailures.length > 0) {
  anyOutput = true;
  console.log(`\n${'─'.repeat(60)}`);
  console.log('  Files that could not be parsed (not analyzed)');
  console.log('─'.repeat(60) + '\n');
  for (const f of parseFailures) console.log(f);
}

if (!anyOutput) console.log(`No orphaned store properties found (${files.length} files analyzed).`);
console.log('');

if (parseFailures.length > 0) process.exit(1);
