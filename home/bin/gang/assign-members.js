import { by } from './lib/util';
import { delegateAny } from './lib/scheduler-delegate';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    try {
        const gangInfo = ns.gang.getGangInformation();
        const memberNames = ns.gang.getMemberNames();
        const readyMembers = [];

        const assignNext = (members, task) => {
            if (members.length > 0) {
                ns.gang.setMemberTask(members.shift(), task);
                return true;
            }
            return false;
        }
        const assignAll = (members, task) => {
            while(assignNext(members, task));
        }
        const totalLevels = (name) => {
            const { str, def, dex, agi } = ns.gang.getMemberInformation(name);
            return str + def + dex + agi;
        }

        // Every member, regardless of operation is
        // checked for ascension, then checked for
        // training
        for (const name of memberNames) {
            const ascension = ns.gang.getAscensionResult(name);
            const skills = ['agi', 'cha', 'def', 'dex', 'hack', 'str'];
            if (ascension != null && ascension.respect === 0 && skills.some(s=>ascension[s] >= 1.1)) {
                // logger(ns).log('Ascending ' + name);
                ns.gang.ascendMember(name);
            }
            const { str, def, dex, agi } = ns.gang.getMemberInformation(name);
            if ([str, def, dex, agi].some(x => x < 1000))
                ns.gang.setMemberTask(name, 'Train Combat');
            else
                readyMembers.push(name);
        }

        if (gangInfo.territoryClashChance > 0) {
            assignAll(readyMembers, 'Territory Warfare');
            return;
        }
        await delegateAny(ns, true)('/bin/gang/decide-war.js', 1, gangInfo.faction, gangInfo.territoryClashChance);
        assignNext(readyMembers, 'Territory Warfare');
        if (gangInfo.wantedPenalty > 1) {
            assignAll(readyMembers, 'Vigilante Justice');
        } else if (memberNames.length < 12) {
            assignAll(readyMembers, 'Human Trafficking');
        } else {
            readyMembers.sort(by(totalLevels));
            assignNext(readyMembers, 'Train Combat');
            if (gangInfo.territory < 100) {
                assignAll(readyMembers, 'Territory Warfare');
            } else {
                assignNext(readyMembers, 'Human Trafficking');
                assignNext(readyMembers, 'Vigilante Justice');
                assignAll(readyMembers, 'Human Trafficking');
            }
        }
    } catch (error) {
        ns.tprint(error); // TODO: Use logger_inline
    }

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

    // ns.gang.getBonusTime() //	Get bonus time.
    // ns.gang.getOtherGangInformation() // 	Get information about the other gangs.
}