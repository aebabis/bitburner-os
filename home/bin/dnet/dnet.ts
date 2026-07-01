/*
 NAME                                 RAM     
 dnet.setStasisLink                   12.00GB 
 dnet.getStasisLinkLimit              0.00GB  
 dnet.getStasisLinkedServers          0.00GB  
 dnet.induceServerMigration           4.00GB  
 dnet.isDarknetServer                 0.10GB  
 dnet.getDepth                        0.10GB  
 dnet.phishingAttack                  2.00GB  
 dnet.getDarknetInstability           0.00GB  
 dnet.getServerRequiredCharismaLevel  0.10GB  
 */

import { ERROR } from '../../lib/colors';

/* USED
 dnet.getBlockedRam                   0.00GB  
 dnet.memoryReallocation              1.00GB  
 dnet.openCache                       2.00GB  
 dnet.probe                           0.20GB  
 dnet.getServerDetails                0.10GB  
 dnet.authenticate                    0.40GB  
 dnet.heartbleed                      0.60GB  
 dnet.connectToSession                0.05GB  
 dnet.nextMutation                    0.00GB  
 dnet.unleashStormSeed                0.10GB  
*/

/* WONDER
 dnet.promoteStock                    2.00GB  
 dnet.labreport                       0.00GB  
 dnet.labradar                        0.00GB 
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

  let version = Math.max(1, ...priorVersions);
  let content = '';

  ns.print('Checking version');
  ns.print(`  Installed versions of ${filename}: ${installedVersions}`);
  ns.print(`  Identified version numbers: ${priorVersions.join(', ')}`);
  ns.print(`  Latest version: ${version}`);

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
          ? `  Installing current state as new version: ${version}`
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

export async function main(ns: NS) {
  ns.disableLog('ALL');
  if (ns.getHostname() !== 'home') {
    const name = ns.getScriptName().split('/').pop()!;
    throw new Error(`darknet launcher (${name}) assumes it runs on home`);
  }
  const getVersions = getVersioner(ns, '/bin/dnet/mole.ts');

  ns.ui.openTail();

  while (true) {
    const { baseName, recent, current } = getVersions();
    if (current !== recent) {
      ns.print('Killing old versions');
      const runningVersions = ns.ps(DARKWEB).filter((ps) => ps.filename.startsWith(baseName));
      for (const ps of runningVersions) {
        if (ps.filename !== current) {
          ns.print('  ' + ps.filename);
          ns.ui.closeTail(ps.pid);
          ns.kill(ps.pid);
        }
      }
    }
    if (!ns.ps(DARKWEB).find((ps) => ps.filename === current)) {
      ns.print('Launching current version: ' + current);
      ns.exec(current, DARKWEB, 1);
    }
    await ns.dnet.nextMutation();
  }
}
