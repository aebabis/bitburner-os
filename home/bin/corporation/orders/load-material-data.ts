import { putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  const { materialNames } = ns.corporation.getConstants();
  const materialData = Object.fromEntries(
    materialNames.map((material) => [
      material,
      ns.corporation.getMaterialData(material),
    ]),
  ) as Record<CorpMaterialName, CorpMaterialConstantData>;
  putStaticData(ns, { materialData });
}
