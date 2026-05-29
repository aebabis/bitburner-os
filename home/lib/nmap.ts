import { putHostnames } from './data-store';

export const nmap = (ns: NS) => {
  const hostnames = new Set(['home']);
  for (const hostname of hostnames)
    for (const neighbor of ns.scan(hostname)) hostnames.add(neighbor);
  return [...hostnames];
};

export const saveHostnames = (ns: NS) => putHostnames(ns, nmap(ns));
