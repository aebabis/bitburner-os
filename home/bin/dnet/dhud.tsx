import { DarknetData } from './ports';

const queue = [] as string[];

const buttonStyles = {
  font: 'inherit',
  color: 'blue',
  background: 'transparent',
  border: 0,
};

const CONNECTED = 'green';
const STASIS = 'gold';
const NOT_CONNECTED = 'grey';

type DarkwebServerSort = 'alpha' | 'access';
let sort = 'access' as DarkwebServerSort;
type DarkwebServerComparator = (a: [string, string[]], b: [string, string[]]) => number;

const showNetwork = (ns: NS) => {
  const network = DarknetData.getNetwork(ns);
  if (network == null) return;
  const passwordData = DarknetData.getPasswords(ns);
  const stasisServers = ns.dnet.getStasisLinkedServers();

  const nonAccessedServers = {} as Record<string, Set<string>>;
  for (const [hostname, neighbors] of Object.entries(network)) {
    for (const neighbor of neighbors) {
      if (network[neighbor] == null) {
        if (nonAccessedServers[neighbor] == null) nonAccessedServers[neighbor] = new Set<string>();
        nonAccessedServers[neighbor].add(hostname);
      }
    }
  }
  for (const [hostname, neighbors] of Object.entries(nonAccessedServers)) {
    network[hostname] = [...neighbors];
  }

  const comparator: DarkwebServerComparator = sort === 'alpha' ?
  ([h1], [h2]) => h1.localeCompare(h2) :
  ([h1], [h2]) => {
    const canAccessH1 = passwordData[h1] != null || ns.ps(h1).length > 0;
    const canAccessH2 = passwordData[h2] != null || ns.ps(h2).length > 0;
    if (canAccessH1 && canAccessH2) return h1.localeCompare(h2);
    else return +canAccessH1 - +canAccessH2;
  }

  const rows = Object.entries(network)
    .filter(([hostname]) => ns.dnet.getServerDetails(hostname).isOnline)
    .sort(comparator);
  const getListingColor = (hostname: string) => {
    if (stasisServers.includes(hostname)) return STASIS;
    else if (passwordData[hostname] != null || ns.ps(hostname).length > 0) return CONNECTED;
    else return NOT_CONNECTED;
  };
  const hasMole = (hostname: string) => ns.ps(hostname).some((ps) => ps.filename.includes('mole'));
  const getHintText = (hostname: string) => {
    const maxLength = 50;
    const { passwordHint } = ns.dnet.getServerDetails(hostname);
    if (passwordHint.length <= maxLength) return passwordHint;
    else return passwordHint.slice(0, maxLength) + '...';
  }
  ns.printRaw(
    <table style={{fontSize: 10 }}>
      <thead>
        <tr>
          <th style={{textAlign: 'left'}}>hostname</th>
          <th style={{textAlign: 'left'}}>hint</th>
          <th style={{textAlign: 'left'}}>neighbors</th>
        </tr>
      </thead>
      <tbody>
      {
        rows.map(([hostname, neighbors]) => (
          <tr>
            <td style={{ color: getListingColor(hostname) }}>{hostname}</td>
            <td>{getHintText(hostname)}</td>
            <td>{neighbors.sort().map((neighbor) => (
              <button
                style={{
                  ...buttonStyles,
                  color: hasMole(neighbor) ? 'skyblue' : '#444',
                }}
                disabled={!hasMole(neighbor)}
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

  while (true) {
    ns.clearLog();
    showNetwork(ns);
    while (queue.length) {
      const hostname = queue.shift();
      for (const ps of ns.ps(hostname)) {
        if (ps.filename.includes('mole')) ns.ui.openTail(ps.pid);
      }
    }
    await ns.sleep(1000);
  }
}
