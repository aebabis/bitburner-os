export async function main(ns: NS) {
  ns.corporation.exportMaterial(
    ...(ns.args as Parameters<typeof ns.corporation.exportMaterial>),
  );
}
