export async function main(ns: NS) {
  const [target, additionalMsec] = ns.args as [string, number];
  await ns.grow(target, { additionalMsec });
}
