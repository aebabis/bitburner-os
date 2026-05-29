import { tprint } from './util';

const DELEGATE_PATTERN =
  /\b(?:rmi|delegateAny|delegate|AnyHostService|Service)\s*\([^)]*\)\s*\(\s*["'`]([^"'`]+)["'`]/g;
const IMPORT_PATTERN = /\bimport\b[^'"]*from\s*["']([^"']+)["']/g;

const resolve = (fromPath, rel) => {
  if (rel.startsWith('/')) return rel.endsWith('.ts') ? rel : rel + '.ts';
  const dir = fromPath.split('/').slice(0, -1).join('/');
  const parts = (dir + '/' + rel).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p) out.push(p);
  }
  const path = '/' + out.join('/');
  return path.endsWith('.ts') ? path : path + '.ts';
};

const hasMain = (content) =>
  /export\s+(async\s+)?function\s+main/.test(content);

const findCallees = (content) => {
  const paths = new Set();
  for (const m of content.matchAll(DELEGATE_PATTERN)) paths.add(m[1]);
  return paths;
};

/** @param {NS} ns
 *  @returns {Record<string, string[]>}
 **/
export const getCallGraph = (ns) => {
  const cache = new Map();
  const read = (path) => {
    if (cache.has(path)) return cache.get(path);
    const content = ns.read(path);
    cache.set(path, content);
    return content;
  };

  const graph = {};
  const visited = new Set();
  const queue = ['/bin/planner.ts'];

  while (queue.length > 0) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);

    const content = read(path);
    if (!content) continue;

    const callees = new Set();

    for (const p of findCallees(content)) callees.add(p);

    for (const m of content.matchAll(IMPORT_PATTERN)) {
      const libPath = resolve(path, m[1]);
      const libContent = read(libPath);
      if (!libContent || hasMain(libContent)) continue;
      for (const p of findCallees(libContent)) callees.add(p);
    }

    graph[path] = [...callees].sort();
    for (const callee of callees) {
      if (!visited.has(callee)) queue.push(callee);
    }
  }
  return graph;
};

/** @param {NS} ns */
export async function main(ns) {
  const graph = getCallGraph(ns);
  ns.write('/tmp/call-graph.json', JSON.stringify(graph, null, 2), 'w');
  tprint(ns)(`INFO call-graph: ${Object.keys(graph).length} nodes`);
}
