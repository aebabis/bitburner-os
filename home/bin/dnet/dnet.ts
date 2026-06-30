/*
 NAME                                 RAM     
 dnet.connectToSession                0.05GB  
 dnet.heartbleed                      0.60GB  
 dnet.openCache                       2.00GB  
 dnet.setStasisLink                   12.00GB 
 dnet.getStasisLinkLimit              0.00GB  
 dnet.getStasisLinkedServers          0.00GB  
 dnet.induceServerMigration           4.00GB  
 dnet.unleashStormSeed                0.10GB  
 dnet.isDarknetServer                 0.10GB  
 dnet.memoryReallocation              1.00GB  
 dnet.getBlockedRam                   0.00GB  
 dnet.getDepth                        0.10GB  
 dnet.phishingAttack                  2.00GB  
 dnet.getDarknetInstability           0.00GB  
 dnet.getServerRequiredCharismaLevel  0.10GB  
 */

/* USED
 dnet.authenticate                    0.40GB  
 dnet.probe                           0.20GB  
 dnet.getServerDetails                0.10GB  
 dnet.nextMutation                    0.00GB  
*/

/* WONDER
 dnet.promoteStock                    2.00GB  
 dnet.labreport                       0.00GB  
 dnet.labradar                        0.00GB 
 */

export async function main(ns: NS) {
  ns.ui.openTail();

  while (true) {
    ns.clearLog();
    for (const ps of ns.ps('darkweb')) {
      if (ps.filename.includes('mole.ts')) {
        ns.ui.closeTail(ps.pid);
        ns.kill(ps.pid);
      }
    }
    ns.scp(ns.ls('home', '/bin/dnet/'), 'darkweb', 'home');
    ns.exec('/bin/dnet/mole.ts', 'darkweb', 1, Date.now());
    await ns.dnet.nextMutation();
  }
}
