import { runInPlace } from './in-place';

export const $getBackdoorPath = (ns: NS, port: number) =>
  runInPlace(
    ns,
    port,
  )((hostnames: string[]) => {
    const PRIORITIES = [
      'CSEC',
      'I.I.I.I',
      'avmnite-02h',
      'run4theh111z',
      'The-Cave',
      'w0r1d_d43m0n',
    ];

    const getPathTo = (ns: NS, hostname: string) => {
      if (ns['getServer'](hostname).isConnectedTo) return [];
      const next: Record<string, string> = {};
      const visited = [hostname];
      const path = (start: string): string[] =>
        start === hostname ? [hostname] : [start, ...path(next[start])];
      for (let i = 0; i < visited.length; i++) {
        const neighbors = ns['scan'](visited[i]).filter((s) => !visited.includes(s));
        for (const neighbor of neighbors) {
          visited.push(neighbor);
          next[neighbor] = visited[i];
          const { isConnectedTo, backdoorInstalled } = ns['getServer'](neighbor);
          if (isConnectedTo) return path(visited[i]);
          else if (neighbor === 'home' || backdoorInstalled) return path(neighbor);
        }
      }
      return [];
    };

    const skill = ns['getHackingLevel']();
    const backdoorableServers = hostnames
      .map(ns['getServer'])
      .filter((server) => server.hasAdminRights)
      .filter((server) => !server.purchasedByPlayer)
      .filter((server) => !server.backdoorInstalled)
      .filter((server) => (server.requiredHackingSkill ?? Infinity) <= skill);

    if (backdoorableServers.length === 0) return null;

    const questTarget = backdoorableServers.find((server) => PRIORITIES.includes(server.hostname));

    if (questTarget != null) return getPathTo(ns, questTarget.hostname);

    const routes = backdoorableServers.map((server) => getPathTo(ns, server.hostname));
    return routes.sort((a, b) => a.length - b.length)[0];
  });
