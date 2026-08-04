const randCctType = (ns: NS) => {
  const types = Object.values(ns.enums.CodingContractName);
  const index = Math.floor(Math.random() * types.length);
  return types[index];
};

export async function main(ns: NS) {
  const type =
    ((await ns.prompt('Contract Type', {
      type: 'select',
      choices: Object.values(ns.enums.CodingContractName),
    })) as CodingContractName) || randCctType(ns);
  const count =
    (await ns.prompt('Count', {
      type: 'text',
    })) || '1';
  for (let i = 0; i < +count; i++) ns.codingcontract.createDummyContract(type, 'home');
}
