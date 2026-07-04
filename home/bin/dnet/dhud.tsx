const DARKNET_CONNECTIONS = 12289108104003;

const showNetwork = (ns: NS) => {
  const connections = ns.peek(DARKNET_CONNECTIONS) as Record<string, string[]> | null;
  if (connections == null) return;
  const rows = Object.entries(connections).sort(([h1], [h2]) => h1.localeCompare(h2));
  ns.printRaw(
    <table>
      <thead><tr><th>hostname</th><th>neighbors</th></tr></thead>
      <body>
      {
        rows.map(([hostname, neighbors]) => (
          <tr>
            <td>{hostname}</td>
            <td>{neighbors.sort().map((neighbor) => (<button>{neighbor}</button>))}</td>
          </tr>
        ))
      }
      </body>
    </table>
  );
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  if (ns.getHostname() !== 'darkweb') {
    const name = ns.getScriptName().split('/').pop()!;
    throw new Error(`${name} must be run on darkweb`);
  }

  ns.ui.openTail();

  while (true) {
    ns.clearLog();
    showNetwork(ns);
    await ns.sleep(100);
  }
}
