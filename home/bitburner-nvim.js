/**
 * bitburner-nvim companion script (tier 3)
 *
 * Polls game state and writes it to OUTPUT_FILE so the bitburner.nvim
 * plugin can display live info in your statusline.
 *
 * OUTPUT CONTRACT — call ns.write(OUTPUT_FILE, JSON.stringify(data), "w")
 * on a regular interval where `data` matches this shape:
 *
 *   {
 *     v:           1,            // schema version — must be 1
 *     ts:          Date.now(),
 *     ram:         { max: number, used: number },
 *     player:      { money: number, hacking: number },  // tier 2+
 *     procs:       [{ file, pid, threads }],            // tier 2+
 *     reset:       { bitnode, playtime },               // tier 3+
 *     status:      string,        // optional — shown verbatim in statusline
 *     last_cmd_id: number,        // ack for last command received
 *   }
 *
 * You can replace this script entirely as long as you honour the contract.
 * Customise `formatStatus` below to change what appears in Neovim.
 */

const OUTPUT_FILE = "/.bitburner/info.json";
const CMD_FILE = "/.bitburner/cmd.json";
const INTERVAL_MS = 2000;

/** @typedef {{v: number, ts: number, ram: {max: number, used: number}, player: {money: number, hacking: number}, procs: {file: string, pid: number, threads: number, args: ScriptArg[]}[], status: string, reset: {bitnode: number, playtime: number}, last_cmd_id: number}} NvimData */

/** @param {NvimData} data */
function formatStatus(data) {
  const ram = `home:${Math.round(data.ram.used)}/${Math.round(data.ram.max)}GB`;
  const money = formatMoney(data.player.money);
  const hk = `hk:${data.player.hacking}`;
  return [ram, money, hk].join(" | ");
}

/** @param {number} n */
function formatMoney(n) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}t`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}b`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}m`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}k`;
  return `$${Math.round(n)}`;
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  let lastCmdId = -1;
  while (true) {
    const data = /** @type {NvimData} */ ({ v: 1, ts: Date.now() });
    data.ram = {
      max: ns.getServerMaxRam("home"),
      used: ns.getServerUsedRam("home"),
    };
    const p = ns.getPlayer();
    data.player = { money: p.money, hacking: p.skills.hacking };
    data.procs = ns.ps("home").map((proc) => ({
      file: proc.filename,
      pid: proc.pid,
      threads: proc.threads,
      args: proc.args,
    }));
    data.status = formatStatus(data);
    const r = ns.getResetInfo();
    data.reset = { bitnode: r.currentNode, playtime: p.totalPlaytime };
    const cmdRaw = ns.read(CMD_FILE);
    if (cmdRaw) {
      try {
        const cmd = JSON.parse(cmdRaw);
        if (cmd.id !== lastCmdId) {
          lastCmdId = cmd.id;
          if (cmd.restart_if_running && cmd.pushed) {
            const procs = ns
              .ps("home")
              .filter((p) => p.filename === cmd.pushed);
            for (const proc of procs) {
              ns.kill(proc.pid);
              ns.run(cmd.pushed, proc.threads, ...proc.args);
            }
          }
          if (cmd.run) ns.run(cmd.run);
        }
      } catch {}
    }
    data.last_cmd_id = lastCmdId;
    ns.write(OUTPUT_FILE, JSON.stringify(data), "w");
    await ns.sleep(INTERVAL_MS);
  }
}
