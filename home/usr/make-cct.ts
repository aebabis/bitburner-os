const randCctType = (ns: NS) => {
  const types = Object.values(ns.enums.CodingContractName);
  const index = Math.floor(Math.random() * types.length);
  return types[index];
};

export async function main(ns: NS) {
  const [type = randCctType(ns), hostname] = ns.args as [CodingContractName, string | undefined];
  ns.codingcontract.createDummyContract(type, hostname);
}
