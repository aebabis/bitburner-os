type BuyMaterialArgs = [string, CityName, CorpMaterialName, number];
export async function main(ns: NS) {
  ns.corporation.buyMaterial(...(ns.args as BuyMaterialArgs));
}
