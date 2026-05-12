import { putHostnames } from "./data-store";

/** @param {NS} ns **/
export const nmap = (ns) => {
  const hostnames = new Set(["home"]);
  for (const hostname of hostnames)
    for (const neighbor of ns.scan(hostname)) hostnames.add(neighbor);
  return [...hostnames];
};

/** @param {NS} ns **/
export const saveHostnames = (ns) => putHostnames(ns, nmap(ns));
