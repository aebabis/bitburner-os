import { GANG_DATA, GANG_CACHE } from './etc/filenames';
import { snippet, delegate } from './lib/scheduler-delegate';

// import { printTaskTable } from './bin/gang/task-table';
// import { by } from './lib/util';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    await ns.write(GANG_DATA, '', 'w');
    await ns.write(GANG_CACHE, '', 'w');

    do {
        await delegate(ns)('/bin/gang/gang-data.js', 'home');
        await ns.sleep(1000);
    } while((await ns.read(GANG_DATA) === ''));

    // TODO: Enable automatic gang creation
    // ns.gang.createGang('Slum Snakes');
    while ((await ns.read(GANG_CACHE)) === '') {
        // Schedule in-gang check
        await delegate(ns)('/bin/gang/gang-info.js');
        await ns.sleep(1000)
    }

    // If the gang cache has data, we have a gang.
    // Start scheduling gang management tasks

    const RepeatingTask = (action, interval, hostname='home') => {
        let lastRun = 0;
        return {
            ready: () => Date.now() - lastRun >= interval,
            go: async () => {
                lastRun = Date.now();
                return action();
            }
        }
    };

    const recruit = RepeatingTask(async() => {
        return delegate(ns)('/bin/gang/recruit.js');
    }, 10000);

    const assign = RepeatingTask(async() => {
        return delegate(ns)('/bin/gang/assign-members.js');
    }, 5000);

    // Next RepeatingTask:
    // - Update cache 5000?
    //      ns.gang.getGangInformation() // 	Get information about your gang.
    // - Check territoryWarefareEngaged from cache
    //      Allocate attackers OR
    //          ns.gang.getChanceToWinClash(gangName) //	Get chance to win clash with other gang.
    //          ns.gang.setTerritoryWarfare(engage) // 	Enable/Disable territory warfare.
    //      Allocate crime and level-ups
    //          ns.gang.getMemberInformation(name) // 	Get information about a specific gang member.
            //  ns.gang.getMemberNames() // 	List all gang members.
    //          ns.gang.setMemberTask(memberName, taskName) // 	Set gang member to task.
    // - Buy equipment
    //      ns.gang.getEquipmentCost(equipName) //	Get cost of equipment.
    //      ns.gang.purchaseEquipment(memberName, equipName) // 	Purchase an equipment for a gang member.
    // - Ascensions
        //  ns.gang.ascendMember(memberName) //	Ascend a gang member.
        //  ns.gang.getAscensionResult(memberName) //	Get the result of an ascension without ascending.

    const tasks = [recruit, assign];
    while (true) {
        for (const task of tasks) {
            if (task.ready())
                await task.go();
        }
        await ns.sleep(200);
    }





    // ns.gang.getBonusTime() //	Get bonus time.
    // ns.gang.getOtherGangInformation() // 	Get information about the other gangs.
}