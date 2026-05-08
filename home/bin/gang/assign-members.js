import { by } from "../../lib/util";
import { delegateAny } from "../../lib/scheduler-delegate";
import { getGangData, putGangData } from "../../lib/data-store";
import { logger } from "../../lib/logger";
import { isRepBound } from "../../lib/query-service";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  try {
    const gangInfo = ns.gang.getGangInformation();
    const memberNames = ns.gang.getMemberNames();
    const readyMembers = [];

    putGangData(ns, { gangInfo, memberNames });

    const assignNext = (/** @type {string[]} */ members, /** @type {string} */ task) => {
      if (members.length > 0) {
        ns.gang.setMemberTask(/** @type {string} */ (members.shift()), task);
        return true;
      }
      return false;
    };
    const assignAll = (/** @type {string[]} */ members, /** @type {string} */ task) => {
      while (assignNext(members, task));
    };
    const totalLevels = (/** @type {string} */ name) => {
      const { str, def, dex, agi } = ns.gang.getMemberInformation(name);
      return str + def + dex + agi;
    };
    const needsPower = () => {
      const { enemyInfo } = getGangData(ns) || {};
      return (
        enemyInfo &&
        enemyInfo.some(
          (/** @type {{territory: number, clashWinChance: number}} */ enemy) => enemy.territory > 0 && enemy.clashWinChance < 0.8,
        )
      );
    };
    const respect = (/** @type {string} */ name) => ns.gang.getMemberInformation(name).earnedRespect;
    const needsTraining = (/** @type {string} */ name) => {
      const { str, def, dex, agi } = ns.gang.getMemberInformation(name);
      return [str, def, dex, agi].some((x) => x < 1000);
    };
    const readyForAscension = (/** @type {string} */ name) => {
      const ascension = ns.gang.getAscensionResult(name);
      if (ascension == null) return false;
      const skills = /** @type {(keyof GangMemberAscension)[]} */ (["agi", "cha", "def", "dex", "hack", "str"]);
      if (!skills.some((s) => ascension[s] >= 1.1)) return false;
      return ascension.respect / gangInfo.respect < 0.15;
    };

    for (const name of memberNames) {
      if (readyForAscension(name)) ns.gang.ascendMember(name);
      if (needsTraining(name)) ns.gang.setMemberTask(name, "Train Combat");
      else readyMembers.push(name);
    }
    await delegateAny(ns, true)(
      "/bin/gang/decide-war.js",
      1,
      gangInfo.faction,
      gangInfo.territoryClashChance,
    );
    readyMembers.sort(by((/** @type {string} */ name) => -respect(name)));
    if (gangInfo.territory < 1) assignNext(readyMembers, "Territory Warfare");
    if (gangInfo.wantedPenalty > 1) {
      assignAll(readyMembers, "Vigilante Justice");
    } else if (memberNames.length < 12) {
      assignAll(readyMembers, "Human Trafficking");
    } else {
      readyMembers.sort(by(totalLevels));
      assignNext(readyMembers, "Train Combat");
      if (gangInfo.territory < 1 && needsPower()) {
        if (memberNames.length === 12)
          assignNext(readyMembers, "Human Trafficking");
        assignAll(readyMembers, "Territory Warfare");
      } else {
        assignNext(readyMembers, "Human Trafficking");
        assignNext(readyMembers, "Vigilante Justice");
        if (isRepBound(ns)) assignAll(readyMembers, "Terrorism");
        else assignAll(readyMembers, "Human Trafficking");
      }
    }
  } catch (error) {
    console.error(error);
    await logger(ns).error(error);
  }

  // TODO:
  // ns.gang.purchaseEquipment(memberName, equipName) // 	Purchase an equipment for a gang member.
  // ns.gang.getBonusTime()?
}
