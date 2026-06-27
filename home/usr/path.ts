const pathTo = (ns: NS, to: string, from = ns.getHostname(), except?: string): string[] | null => {
  if (from === to) {
    return [to];
  }
  const connections = ns.scan(from).filter((connection) => connection !== except);
  for (const connection of connections) {
    const path = pathTo(ns, to, connection, from);
    if (path) {
      return [from, ...path];
    }
  }
  return null;
};

export async function main(ns: NS) {
  const [target] = ns.args as string[];
  const path = pathTo(ns, target);
  if (path) {
    const str = path.join(';connect ');
    ns.tprint(str);
    navigator.clipboard.writeText(str);
    ns.toast('Copied to clipboard');
  } else ns.tprint('ERRORserver not in network: ' + target);
}
