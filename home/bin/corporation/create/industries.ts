import { DivisionNames } from '../constants';

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const { divisions } = ns.corporation.getCorporation();

  if (!divisions.includes(DivisionNames['Agriculture'])) {
    ns.corporation.expandIndustry('Agriculture', DivisionNames['Agriculture']);
  }
}
