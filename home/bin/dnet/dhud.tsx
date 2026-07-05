import { DarknetData } from './ports';

const queue = [] as string[];

const buttonStyles = {
  font: 'inherit',
  color: 'blue',
  background: 'transparent',
  border: 0,
};

const showNetwork = (ns: NS) => {
  const connections = DarknetData.getNetwork(ns);
  if (connections == null) return;
  const rows = Object.entries(connections).sort(([h1], [h2]) => h1.localeCompare(h2));
  ns.printRaw(
    <table>
      <thead>
        <tr>
          <th style={{textAlign: 'left'}}>hostname</th>
          <th style={{textAlign: 'left'}}>neighbors</th>
        </tr>
      </thead>
      <tbody>
      {
        rows.map(([hostname, neighbors]) => (
          <tr>
            <td>{hostname}</td>
            <td>{neighbors.sort().map((neighbor) => (
              <button
                style={buttonStyles}
                onClick={() => queue.push(neighbor)}
              >
                {neighbor}
              </button>))}
            </td>
          </tr>
        ))
      }
      </tbody>
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
    while (queue.length) {
      const hostname = queue.shift();
      for (const ps of ns.ps(hostname)) {
        if (ps.filename.includes('mole')) ns.ui.openTail(ps.pid);
      }
    }
    await ns.sleep(100);
  }
}
