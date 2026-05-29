export async function main(ns: NS) {
  for (const ps of ns.ps('home')) {
    if (ps.filename === 'bin/profiler.ts') {
      ns.kill(ps.pid);
      ns.ui.closeTail(ps.pid);
    }
  }
  ns.exec('./bin/profiler.ts', 'home');
}
