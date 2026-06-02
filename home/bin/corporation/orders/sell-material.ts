export async function main(ns: NS) {
  ns.corporation.sellMaterial(
    ...(ns.args as Parameters<typeof ns.corporation.sellMaterial>),
  );
}
