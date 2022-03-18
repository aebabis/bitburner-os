/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    try {
        const gangInfo = ns.gang.getGangInformation();
        const memberNames = ns.gang.getMemberNames();
        if (gangInfo.territoryClashChance > 0) {
            memberNames.forEach(name => ns.gang.setMemberTask(name, 'Territory Warfare'));
        } else {
            memberNames.forEach(name => {
                const ascension = ns.gang.getAscensionResult(name);
                const skills = ['agi', 'cha', 'def', 'dex', 'hack', 'str'];
                if (ascension != null && ascension.respect === 0 && skills.some(s=>ascension[s] >= 1.1)) {
                    // logger(ns).log('Ascending ' + name);
                    ns.gang.ascendMember(name);
                }
            })
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