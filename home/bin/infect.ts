export const infect = (ns: NS, ...hostnames: string[]) => {
  const workers = ns.ls('home', 'bin/workers/');
  for (const hostname of hostnames) ns.scp(workers, hostname, 'home');
};

export const fullInfect = (ns: NS, ...hostnames: string[]) => {
  const JS = ns.ls('home').filter((f) => f.endsWith('.ts'));
  for (const hostname of hostnames) ns.scp(JS, hostname, 'home');
};
