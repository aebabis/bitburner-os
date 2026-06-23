import { THREADPOOL } from '../etc/config';

const partialInfect = (ns: NS, ...hostnames: string[]) => {
  const workers = ns.ls('home', 'bin/workers/');
  for (const hostname of hostnames) ns.scp(workers, hostname, 'home');
};

const fullInfect = (ns: NS, ...hostnames: string[]) => {
  const JS = ns.ls('home').filter((f) => f.endsWith('.ts'));
  for (const hostname of hostnames) ns.scp(JS, hostname, 'home');
};

const canRunCode = (ns: NS) => (hostname: string) => ns.getServerMaxRam(hostname) >= 1.6;

const SERVICE_SERVERS = [`${THREADPOOL}-01`, `${THREADPOOL}-02`];
export const infect = (ns: NS, ...hostnames: string[]) => {
  const workers = ns.ls('home', 'bin/workers/');
  for (const hostname of hostnames) {
    if (hostname !== 'home' && canRunCode(ns)(hostname)) {
      // To reduce the size of the game save file, only put
      // non-worker programs on first ~6 company servers
      // and first 2 cloud servers.
      if (ns.getServerRequiredHackingLevel() <= 50 || SERVICE_SERVERS.includes(hostname)) {
        fullInfect(ns, hostname);
      } else {
        partialInfect(ns, hostname);
      }
    }
    ns.scp(workers, hostname, 'home');
  }
};
