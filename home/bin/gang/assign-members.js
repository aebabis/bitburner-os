import { by } from './lib/util';
import { delegateAny } from './lib/scheduler-delegate';
import { getGangData } from './lib/data-store';
import { logger } from './lib/logger';

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
        const needsPower = () => {
            const { enemyInfo } = getGangData(ns) || {};
            return enemyInfo && enemyInfo.some(enemy => enemy.territory > 0 && enemy.clashWinChance < .8);
        }
        const respect = (name) => ns.gang.getMemberInformation(name).earnedRespect;

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

        ns.tprint('power', needsPower());

        if (gangInfo.territoryClashChance > 0 && needsPower()) {
            assignAll(readyMembers, 'Territory Warfare');
            return;
        }
        await delegateAny(ns, true)('/bin/gang/decide-war.js', 1, gangInfo.faction, gangInfo.territoryClashChance);
        readyMembers.sort(by(name=>-respect(name)));
        assignNext(readyMembers, 'Territory Warfare');
        if (gangInfo.wantedPenalty > 1) {
            assignAll(readyMembers, 'Vigilante Justice');
        } else if (memberNames.length < 12) {
            assignAll(readyMembers, 'Human Trafficking');
        } else {
            readyMembers.sort(by(totalLevels));
            assignNext(readyMembers, 'Train Combat');
            if (gangInfo.territory < 100 && needsPower()) {
                assignAll(readyMembers, 'Territory Warfare');
            } else {
                assignNext(readyMembers, 'Human Trafficking');
                assignNext(readyMembers, 'Vigilante Justice');
                assignAll(readyMembers, 'Human Trafficking');
            }
        }
    } catch (error) {
        console.error(error);
        logger(ns).error(error);
    }

    // TODO: 
    // ns.gang.purchaseEquipment(memberName, equipName) // 	Purchase an equipment for a gang member.
    // ns.gang.getBonusTime()?
}