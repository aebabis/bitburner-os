import { ERROR } from '../lib/colors';
import { getHostnames } from '../lib/data-store';

const getFilenames = (ns: NS, descriptor: string) => {
  const scriptFiles = [
    ...new Set(['.ts', '.js', '.tsx', 'jsx'].flatMap((ext) => ns.ls('home', ext))),
  ];
  const baseMatches = scriptFiles.filter((filename) => filename.includes(descriptor));
  if (baseMatches.length > 1) {
    const dotMatches = scriptFiles.filter((filename) => filename.includes(`${descriptor}.`));
    if (dotMatches.length === 1) return dotMatches;
  }
  return baseMatches;
};

export async function main(ns: NS) {
  const { _, all } = ns.flags([['all', false]]);
  const [descriptor] = _ as (string | number)[];
  if (typeof descriptor !== 'number' && typeof descriptor !== 'string') {
    ns.tprint(ERROR + 'Failed to provide a program descriptor (e.g. "access", "pool.ts")');
  }
  if (typeof descriptor === 'number') {
    ns.ui.openTail(descriptor);
  } else {
    const filenames = getFilenames(ns, descriptor);
    if (filenames.length === 0) {
      ns.tprint(ERROR + 'No scripts in home found matching: ' + descriptor);
      return;
    }
    const hostnames = [...getHostnames(ns), 'darkweb'];
    const runningScripts = hostnames.flatMap((hostname) =>
      filenames.map((filename) => ns.getRunningScript(filename, hostname)).filter((s) => s != null),
    );
    ns.tprint(runningScripts);
    if (runningScripts.length > 1 && all !== true) {
      const runningFilenames = new Set(runningScripts.map((script) => script.filename));
      ns.tprint(ERROR + 'Multiple processes matched: ' + [...runningFilenames].join(', '));
      ns.tprint(ERROR + 'Run with --all to open all');
    } else {
      for (const { pid } of runningScripts) ns.ui.openTail(pid);
    }
  }
}
