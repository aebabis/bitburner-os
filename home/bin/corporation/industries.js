import { DivisionNames } from './constants';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const { divisions } = ns.corporation.getCorporation();

  if (!divisions.includes(DivisionNames['Agriculture'])) {
    ns.corporation.expandIndustry('Agriculture', DivisionNames['Agriculture']);
  }
}
