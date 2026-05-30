import { HACK, GROW, WEAKEN, SHARE } from '../etc/filenames';

export const infect = (ns: NS, ...hostnames: string[]) => {
  for (const hostname of hostnames)
    ns.scp([HACK, GROW, WEAKEN, SHARE], hostname, 'home');
};

export const fullInfect = (ns: NS, ...hostnames: string[]) => {
  const JS = ns.ls('home').filter((f) => f.endsWith('.ts'));
  for (const hostname of hostnames) ns.scp(JS, hostname, 'home');
};

export async function main(ns: NS) {
  if (ns.args.some((arg) => typeof arg !== 'string'))
    throw new Error('Args list contains a non string: ' + ns.args);
  return infect(ns, ...(ns.args as string[]));
}
