type CancelExportMaterialArgs = [
  string,
  CityName,
  string,
  CityName,
  CorpMaterialName,
];
export async function main(ns: NS) {
  ns.corporation.cancelExportMaterial(...(ns.args as CancelExportMaterialArgs));
}
