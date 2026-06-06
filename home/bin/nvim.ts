import { getStaticData } from '../lib/data-store';
// import { fullInfect } from './infect';

const OUTPUT_FILE = '/.bitburner/info.json';
const CMD_FILE = '/.bitburner/cmd.json';
const INTERVAL_MS = 2000;

function getStatusLine(ns: NS) {
  const { resetInfo } = getStaticData(ns);
  const { money, skills } = ns.getPlayer();
  return [
    `bn:${resetInfo.currentNode}`,
    formatMoney(money),
    `hk:${skills.hacking}`,
  ].join(' | ');
}

function formatMoney(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}t`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}b`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}m`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}k`;
  return `$${Math.round(n)}`;
}

const seenCommandIds = new Set<number>();

const getCommand = (ns: NS): string | Parameters<typeof ns.exec> | null => {
  const content = ns.read(CMD_FILE);
  if (!content) return null;
  ns.rm(CMD_FILE);
  const { run, id } = JSON.parse(content);
  if (seenCommandIds.has(id)) return null;
  seenCommandIds.add(id);
  if (run.startsWith('[') || run.startsWith('"')) return JSON.parse(run);
  ns.tprint(`Received command (${id}) from nvim: ` + run);
  return run;
};

export async function main(ns: NS) {
  try {
    while (true) {
      const command = getCommand(ns);
      if (command) {
        if (typeof command === 'string') ns.exec(command, 'home');
        else ns.exec(...command);
      }
      ns.write(OUTPUT_FILE, JSON.stringify({ status: getStatusLine(ns) }), 'w');
      await ns.sleep(INTERVAL_MS);
    }
  } catch (error) {
    console.error(error);
  }
}
