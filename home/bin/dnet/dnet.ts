import { ERROR } from '../../lib/colors';
import { putMoneyData } from '../../lib/data-store';
import { DarknetData } from './ports';

/* USED
 dnet.getBlockedRam                   0.00GB  
 dnet.memoryReallocation              1.00GB  
 dnet.openCache                       2.00GB  
 dnet.probe                           0.20GB  
 dnet.getServerDetails                0.10GB  
 dnet.authenticate                    0.40GB  
 dnet.heartbleed                      0.60GB  
 dnet.labradar                        0.00GB 
 dnet.labreport                       0.00GB  
 dnet.connectToSession                0.05GB  
 dnet.nextMutation                    0.00GB  
 dnet.unleashStormSeed                0.10GB  
 dnet.phishingAttack                  2.00GB  

 dnet.setStasisLink                   12.00GB 
 dnet.getStasisLinkLimit              0.00GB  
 dnet.getStasisLinkedServers          0.00GB  
 dnet.getDepth                        0.10GB  
*/

/* WONDER
 dnet.promoteStock                    2.00GB  
 dnet.induceServerMigration           4.00GB  
 dnet.isDarknetServer                 0.10GB  
 dnet.getDarknetInstability           0.00GB  
 dnet.getServerRequiredCharismaLevel  0.10GB  
 */

const DARKWEB = 'darkweb';

const getVersioner = (ns: NS, filename: string) => {
  filename = filename.replace(/^\//, '');

  const baseName = filename.replace(/\.ts/, '');
  const installedVersions = ns.ls(DARKWEB).filter((name) => name.startsWith(baseName));
  const priorVersions = installedVersions
    .map((name) => name.split('-').pop()!)
    .map((name) => name.split('.').shift()!)
    .map((name) => name.match(/\d+/) || ['1'])
    .map(([version]) => +version);

  let version = Math.max(0, ...priorVersions);
  let content = '';

  ns.print(`Latest Version: ${version}`);

  const getVersionedName = () =>
    filename.replace(/([^/]+)\.ts$/, (_, name) => `${name}-v${version}.ts`);
  const downloadLatest = () => {
    const recentVersion = getVersionedName();
    const latest = ns.read(filename);
    if (latest === '') {
      ns.print(ERROR + 'Current state of base program not runnable. Skipping');
    } else if (content !== latest) {
      version++;
      ns.print(
        content === ''
          ? `Installing current state as new version: ${version}`
          : `New version detected: ${version}`,
      );
      const newVersion = getVersionedName();
      ns.write(newVersion, latest);
      ns.scp(newVersion, DARKWEB, 'home');
      ns.rm(newVersion, 'home');
      content = latest;
    }
    return {
      baseName,
      version,
      recent: recentVersion,
      current: getVersionedName(),
    };
  };

  return downloadLatest;
};

const ensureLatest = (ns: NS, baseName: string, current: string, hostname: string) => {
  const runningVersions = ns.ps(hostname).filter((ps) => ps.filename.startsWith(baseName));
  for (const ps of runningVersions) {
    if (ps.filename !== current) {
      ns.print('Killing ' + ps.filename + ' on ' + hostname);
      ns.ui.closeTail(ps.pid);
      ns.kill(ps.pid);
    }
  }
  if (!ns.ps(hostname).find((ps) => ps.filename === current)) {
    if (hostname !== DARKWEB) ns.scp(current, hostname, DARKWEB);
    if (ns.exec(current, hostname)) {
      ns.print('Started ' + current + ' on ' + hostname);
    }
  }
};

const cleanNetworkMap = (ns: NS) => {
  const network = DarknetData.getNetwork(ns);
  if (network == null) return;
  const isOnline = (hostname: string) => ns.dnet.getServerDetails(hostname).isOnline;
  for (const [hostname, neighbors] of Object.entries(network)) {
    if (!isOnline(hostname)) delete network[hostname];
    else network[hostname] = neighbors.filter(isOnline);
  }
  DarknetData.saveNetwork(ns, network);
};

const NUMBER_SUFFIXES = ' kmbtqQsSon';
const getMultiplier = (suffix: string) => {
  if (suffix === '') return 1;
  const power =
    suffix[0] === 'e' ? parseInt(suffix.slice(1)) : NUMBER_SUFFIXES.indexOf(suffix[0]) * 3;
  return 10 ** power;
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  let totalDarknetIncome = 0;
  if (ns.getHostname() !== 'home') {
    const name = ns.getScriptName().split('/').pop()!;
    throw new Error(`darknet launcher (${name}) assumes it runs on home`);
  }
  const getVersions = getVersioner(ns, '/bin/dnet/mole.ts');
  const getPassword = (hostname: string) => DarknetData.getPassword(ns)(hostname) ?? '';

  DarknetData.reset(ns);

  for (const ps of ns.ps('darkweb')) {
    if (ps.filename === 'bin/dnet/dhud.tsx') {
      ns.ui.closeTail(ps.pid);
      ns.kill(ps.pid);
    }
  }

  ns.scp(ns.ls('home', '/bin/dnet/'), 'darkweb', 'home');
  ns.exec('/bin/dnet/dhud.tsx', 'darkweb');

  while (true) {
    const { baseName, current } = getVersions();
    ensureLatest(ns, baseName, current, DARKWEB);
    for (const stasisServer of ns.dnet.getStasisLinkedServers()) {
      if (
        ns.dnet.getServerDetails(stasisServer).hasSession ||
        ns.dnet.connectToSession(stasisServer, getPassword(stasisServer)).success
      ) {
        ensureLatest(ns, baseName, current, stasisServer);
      } else {
        ns.print('Unable to connect to: ' + stasisServer);
      }
    }
    await ns.dnet.nextMutation();

    for (const { message } of DarknetData.takeCacheHistory(ns)) {
      const moneyGained = message.match(/\$(\d+\.\d+)([kmbtqQsSon]|(?:e\d+))?/);
      if (moneyGained) {
        const [, num, suffix] = moneyGained;
        totalDarknetIncome += +num * getMultiplier(suffix);
      }
    }
    const darknetIncome = totalDarknetIncome / ns.getRunningScript()!.onlineRunningTime;
    putMoneyData(ns, { darknetIncome });

    await ns.sleep(1);

    cleanNetworkMap(ns);
  }
}
