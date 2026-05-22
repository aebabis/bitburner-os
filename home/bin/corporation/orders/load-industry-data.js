import { putStaticData } from '../../../lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
  const { industryNames } = ns.corporation.getConstants();
  const industryData = Object.fromEntries(industryNames.map((industry) => (
    [industry, ns.corporation.getIndustryData(industry)]
  )));
  putStaticData(ns, { industryData });
}
