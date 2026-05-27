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

const ROOT = new URL('..', import.meta.url).pathname;
const HOME = join(ROOT, 'home');

// hostnames is an array, not a keyed object — skip it
const STORES = {
  staticData: { get: 'getStaticData', put: 'putStaticData' },
  playerData: { get: 'getPlayerData', put: 'putPlayerData' },
  gangData: { get: 'getGangData', put: 'putGangData' },
  moneyData: { get: 'getMoneyData', put: 'putMoneyData' },
  ramData: { get: 'getRamData', put: 'putRamData' },
  contractData: { get: 'getContractData', put: 'putContractData' },
};

// ── AST helpers ───────────────────────────────────────────────────────────────

function getAllJsFiles(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...getAllJsFiles(full));
    else if (entry.name.endsWith('.js')) result.push(full);
  }
  return result;
}

/** Visit every AST node depth-first. */
function walk(node, fn) {
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

/** True if `node` is a direct call `funcName(ns, ...)`. */
function isCallTo(node, funcName) {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === funcName &&
    node.arguments?.[0]?.type === 'Identifier' &&
    node.arguments[0].name === 'ns'
  );
}

/**
 * True if `node` is an expression whose value comes from a direct call to
 * `getFn(ns)`. Handles `getFn(ns) || {}` and `getFn(ns) ?? {}` fallbacks.
 */
function isStoreInit(node, getFn) {
  if (!node) return false;
  if (isCallTo(node, getFn)) return true;
  if (node.type === 'LogicalExpression')
    return isStoreInit(node.left, getFn) || isStoreInit(node.right, getFn);
  return false;
}

/** Extract property keys from an ObjectExpression or ObjectPattern node. */
function keysOf(node) {
  const keys = new Set();
  for (const prop of node?.properties ?? []) {
    if (prop.type === 'SpreadElement' || prop.type === 'RestElement') continue;
    if (prop.key?.type === 'Identifier') keys.add(prop.key.name);
    else if (prop.key?.type === 'Literal') keys.add(String(prop.key.value));
  }
  return keys;
}

// ── Per-file analysis ─────────────────────────────────────────────────────────

function analyzeFile(src, getFn, putFn) {
  let ast;
  try {
    ast = parse(src, { ecmaVersion: 2022, sourceType: 'module' });
  } catch {
    return { written: new Set(), read: new Set(), warnings: new Set() };
  }

  const written = new Set();
  const read = new Set();
  const warnings = new Set();

  // Pass 1: collect written keys and variable aliases for the store.
  const aliases = new Set(); // names of variables assigned directly from getFn(ns)

  walk(ast, (node) => {
    // putFn(ns, { k: v, k2 }) — record every property key
    if (isCallTo(node, putFn) && node.arguments[1]?.type === 'ObjectExpression')
      for (const k of keysOf(node.arguments[1])) written.add(k);

    if (node.type !== 'VariableDeclarator') return;

    // const { k } = getFn(ns) [or getFn(ns) || {}]
    if (node.id?.type === 'ObjectPattern' && isStoreInit(node.init, getFn))
      for (const k of keysOf(node.id)) read.add(k);

    // const alias = getFn(ns) [or getFn(ns) || {}]
    // Excludes: const x = getFn(ns).key  (init is MemberExpression, not a store init)
    if (node.id?.type === 'Identifier' && isStoreInit(node.init, getFn))
      aliases.add(node.id.name);
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
        const callee =
          node.callee?.type === 'Identifier'
            ? node.callee.name
            : '(expression)';
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

const files = getAllJsFiles(HOME);
const stats = Object.fromEntries(
  Object.keys(STORES).map((s) => [
    s,
    { written: new Map(), read: new Map(), warnings: [] },
  ]),
);

for (const file of files) {
  const rel = relative(HOME, file);
  const src = readFileSync(file, 'utf-8');

  for (const [store, { get, put }] of Object.entries(STORES)) {
    const s = stats[store];
    const { written, read, warnings } = analyzeFile(src, get, put);

    for (const k of written) {
      if (!s.written.has(k)) s.written.set(k, []);
      s.written.get(k).push(rel);
    }
    for (const k of read) {
      if (!s.read.has(k)) s.read.set(k, []);
      s.read.get(k).push(rel);
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
      for (const f of written.get(k)) console.log(`      ← ${f}`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n  Warnings (some reads may not be detected):');
    for (const w of warnings) console.log(w);
  }
}

if (!anyOutput) console.log('No orphaned store properties found.');
console.log('');
