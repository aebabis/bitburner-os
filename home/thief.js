import { execAnyHost, uuid } from './scheduler';
import { by, write } from './lib/util';
import { getTotalFreeRam, getNonPurchasedServers } from './lib/servers';
import { getHThreads, getGWThreads, getWThreads, isServerGroomed } from './lib/hacking';

export const WEAKEN = '/bin/weaken.js';
export const GROW = '/bin/grow.js';
export const HACK = '/bin/hack.js';

const WEAKEN_SRC = `export async function main(ns) {
    const target = ns.args[0];
    await ns.weaken(target);
}`;
const GROW_SRC = `export async function main(ns) {
    const target = ns.args[0];
    await ns.grow(target);
}`;
const HACK_SRC = `export async function main(ns) {
    const target = ns.args[0];
    await ns.write('ledger.txt', await ns.hack(target) + '\\n');
}`;

const THEFT_PORTION = .25;
const SUBTASK_SPACING = 50;
const DEFAULT_THREAD_COUNT = 1024;

/** @param {NS} ns **/
const neededGrowth = (ns, hostname) => ns.getServerMaxMoney(hostname) / ns.getServerMoneyAvailable(hostname);

const groom = async (ns, hostname) => {
    ns.print('Attempting to groom ' + hostname);
    const security = ns.getServerSecurityLevel(hostname);
    const minSecurity = ns.getServerMinSecurityLevel(hostname);
    const money = ns.getServerMoneyAvailable(hostname);
    const maxMoney = ns.getServerMaxMoney(hostname);
    const cores = 1; // TODO
    const weakenTime = ns.getWeakenTime(hostname);

    const secDecrease = security - minSecurity;
    if (secDecrease > 0) {
        const weakThreads = getWThreads(ns, secDecrease, cores);
        if (weakThreads === Infinity) {
            ns.print(`ERROR - Computed hack for ineligible server ${hostname}`);
            await ns.sleep(10000);
            return;
        }
        let threadsRemaining = weakThreads;
        ns.print(`Starting W-attack server=${hostname} W=${weakThreads} (${weakenTime}ms)`);
        while (threadsRemaining > 0) {
            const { threads } = await execAnyHost(ns)(WEAKEN, threadsRemaining, hostname, uuid());
            threadsRemaining -= threads;
        }
        await ns.sleep(weakenTime);
    } else if (security > minSecurity || money < maxMoney) {
        const growTime = ns.getGrowTime(hostname);
        const weakenWait = Math.max(growTime + 50 - weakenTime, 0);
        const growAmount = neededGrowth(ns, hostname);
        const { grow, weak } = getGWThreads(ns, hostname, growAmount, DEFAULT_THREAD_COUNT, cores);
        ns.print(`Starting GW-attack server=${hostname} G=${grow} W=${weak}`);
        try {
            if (weak > 0)
                await execAnyHost(ns)(WEAKEN, weak, hostname, uuid());
            if (grow > 0) {
                await execAnyHost(ns)(GROW, grow, hostname, uuid());
            }
            await ns.sleep(weakenWait);
        } catch (error) {
            ns.print('ERROR: ', error);
        }
        await ns.sleep(200);
    }
}


/** @param {NS} ns **/
const getHackSchedule = async (ns, target) => {
    const weakTime = ns.getWeakenTime(target);

    const hackThreads = Math.min(1024, getHThreads(ns, target, THEFT_PORTION));
    const secIncrease1 = ns.hackAnalyzeSecurity(hackThreads);
    
    const weakThreads1 = getWThreads(ns, secIncrease1) + 1;

    const growFactor  = 1 / (1 - THEFT_PORTION);
    const growThreads = Math.ceil(ns.growthAnalyze(target, growFactor));

    const secIncrease2 = ns.growthAnalyzeSecurity(growThreads);
    const weakThreads2 = getWThreads(ns, secIncrease2) + 3; // ????

    // WINDOWS:
    // WWWWWWWWWWWWWWWWWWWWWWWWWWWW
    //   WWWWWWWWWWWWWWWWWWWWWWWWWWWW
    //        GGGGGGGGGGGGGGGGGGGGGG
    //                   HHHHHHHHH
    const weak1Start = 0;
    const weak2Start = weak1Start + SUBTASK_SPACING * 2;
    // const growStart  = weakTime + SUBTASK_SPACING - growTime;
    // const hackStart  = weakTime - SUBTASK_SPACING * 3 - growTime;

    return async () => {
        await execAnyHost(ns)(WEAKEN, weakThreads1, target);
        const start = Date.now();
        const ts = () => Date.now() - start;
        ns.print(`Attack started on ${target}. W=[${weak1Start}, ${weak2Start} ? ?]`);
        ns.print(`  (${ts()}) weaken T=${weakThreads1}`);
        await ns.sleep(weak2Start - ts());

        await execAnyHost(ns)(WEAKEN, weakThreads2, target);
        ns.print(`  (${ts()}) weaken T=${weakThreads2}`);
        const growTime = ns.getGrowTime(target);
        const growStart = weakTime + SUBTASK_SPACING - growTime;
        await ns.sleep(growStart - ts());

        await execAnyHost(ns)(GROW, growThreads, target);
        ns.print(`  (${ts()}) grow   T=${growThreads}`);
        const hackTime  = ns.getHackTime(target);
        const hackStart = weakTime - SUBTASK_SPACING - hackTime;
        const hackDelay = hackStart - ts();

        // TODO: Write a batcher to prevent excessive job delay
        // if (hackDelay > 0) {
            await ns.sleep(hackDelay);
            const actualHackThreads = getHThreads(ns, target, THEFT_PORTION);
            await execAnyHost(ns)(HACK, actualHackThreads, target);
            ns.print(`  (${ts()}) hack   T=${actualHackThreads}`);
        // } else {
        //     ns.print(`  (${ts()}) hack WINDOW CLOSED`);
        // }
    }
}

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const THIEF = ns.getScriptName();
    const hostname = ns.args[0];

    const getThief = server => ns.getRunningScript(THIEF, 'home', server.hostname);

    if (hostname == null) { // Main process
        await write(ns)(WEAKEN, WEAKEN_SRC, 'w');
        await write(ns)(GROW, GROW_SRC, 'w');
        await write(ns)(HACK, HACK_SRC, 'w');
        while(true) {
            try {
                ns.clearLog();
    
                const hackingLevel = ns.getHackingLevel();
                const freeRam = getTotalFreeRam(ns);
                const expectedValue = ({ hostname, moneyMax }) => ns.hackAnalyzeChance(hostname) * moneyMax;
                const canHack = ({ requiredHackingSkill, hasAdminRights }) =>
                    hasAdminRights && requiredHackingSkill <= hackingLevel;

                ns.print(freeRam);
                if (freeRam >= ns.getScriptRam(WEAKEN) * 100) {
                    const servers = getNonPurchasedServers(ns)
                        .filter(canHack)
                        .filter(server => getThief(server) == null)
                        .filter(server => expectedValue(server) > 0)
                        .sort(by(expectedValue));
                    ns.print(`${servers.length} eligible servers:`);
                    ns.print(servers.map(s=>s.hostname.padEnd(20) + ' ' + s.requiredHackingSkill).join('\n'));
                    if (servers.length > 0) {
                        ns.print('SPAWNING ' + THIEF + ' home ' + 1 + ' ' + servers[0].hostname);
                        ns.exec(THIEF, 'home', 1, servers[0].hostname);
                    }
                } else {
                    ns.print('No available ram to steal with');
                }
            } catch (error) {
                ns.print('ERROR in thief spawing: ' + error.message);
            }
            await ns.sleep(1000);
        }
    } else { // Child process
        while(true) {
            try {
                while (isServerGroomed(ns.getServer(hostname))) {
                    const hwgwFrame = await getHackSchedule(ns, hostname);
                    await hwgwFrame();
                    await ns.sleep(50);
                }
                await groom(ns, hostname);
            } catch (error) {
                ns.print('ERROR in HWGW execution: ' + error);
            }
            await ns.sleep(50);
        }
    }
}