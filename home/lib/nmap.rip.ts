import { runInPlace } from './in-place';

export const $nmap = (ns: NS, runPort: number) =>
  runInPlace(
    ns,
    runPort,
  )(() => {
    const hostnames = new Set(['home']);
    for (const hostname of hostnames)
      for (const neighbor of ns['scan'](hostname)) hostnames.add(neighbor);
    return [...hostnames].filter((hostname) => !hostname.startsWith('hacknet-server'));
  });
