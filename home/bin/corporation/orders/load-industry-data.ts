import { putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  const { industryNames } = ns.corporation.getConstants();
  const industryData = Object.fromEntries(
    industryNames.map((industry) => [
      industry,
      ns.corporation.getIndustryData(industry),
    ]),
  );
  putStaticData(ns, { industryData });
}
