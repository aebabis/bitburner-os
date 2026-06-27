import { THREADPOOL } from '../etc/config';

const partialInfect = (ns: NS, ...hostnames: string[]) => {
  const workers = ns.ls('home', 'bin/workers/');
  for (const hostname of hostnames) ns.scp(workers, hostname, 'home');
};

const fullInfect = (ns: NS, ...hostnames: string[]) => {
  const JS = ns
    .ls('home')
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => !f.startsWith('boot'))
    .filter((f) => !f.startsWith('usr'))
    .filter((f) => !f.startsWith('tmp'));
  for (const hostname of hostnames) ns.scp(JS, hostname, 'home');
};

const canRunCode = (ns: NS) => (hostname: string) => ns.getServerMaxRam(hostname) >= 1.6;

export const infect = (ns: NS, ...hostnames: string[]) => {
  const workers = ns.ls('home', 'bin/workers/');
  for (const hostname of hostnames) {
    if (hostname !== 'home' && canRunCode(ns)(hostname)) {
      // To reduce boot time and save size, only put
      // non-worker programs on first cloud server and ~4 company servers
      if (ns.getServerRequiredHackingLevel() <= 10 || hostname === `${THREADPOOL}-01`) {
        fullInfect(ns, hostname);
      } else {
        partialInfect(ns, hostname);
      }
    }
    ns.scp(workers, hostname, 'home');
  }
};
