/** @param {NS} ns */
export async function main(ns) {
  for (const ps of ns.ps("home")) {
    if (ps.filename === "bin/profiler.js") {
      ns.kill(ps.pid);
      ns.ui.closeTail(ps.pid);
    }
  }
  ns.exec("./bin/profiler.js", "home");
}
