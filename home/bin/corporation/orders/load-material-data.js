import { putStaticData } from '../../../lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
  const { materialNames } = ns.corporation.getConstants();
  const materialData = Object.fromEntries(materialNames.map((material) => (
    [material, ns.corporation.getMaterialData(material)]
  )));
  putStaticData(ns, { materialData });
}
