export async function main(ns: NS) {
  while (ns.gang.recruitMember(crypto.randomUUID()));
}
