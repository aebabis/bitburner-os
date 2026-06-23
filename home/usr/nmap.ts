const printTree = (
  ns: NS,
  hostname = ns.getHostname(),
  visited = new Set([hostname]),
  indent = 0,
) => {
  const lead = ' '.repeat(indent);
  ns.tprint(lead + hostname);
  for (const connection of ns.scan(hostname)) {
    if (!visited.has(connection)) {
      visited.add(connection);
      printTree(ns, connection, visited, indent + 1);
    }
  }
};

export async function main(ns: NS) {
  printTree(ns);
}
