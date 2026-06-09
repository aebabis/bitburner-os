export async function main(ns: NS) {
  for (const file of ns.ls('home')) ns.rm(file);
}
