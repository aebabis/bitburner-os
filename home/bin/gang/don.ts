import { putMoneyData } from '../../lib/data-store';
import { isRepBound } from '../../lib/goals/goals';
import { inPlace } from '../../lib/in-place';
import { table } from '../../lib/table';
import { by, randPort } from '../../lib/util';
import { getFightWinRates, needsPower } from './util';

export async function main(ns: NS) {
  ns.disableLog('ALL');

  // Reserve RAM
  ns.gang.ascendMember;

  ns.ui.openTail();
  ns.ui.resizeTail(300, 160);

  const $ns = inPlace(ns, randPort());

  while (!ns.gang.inGang()) {
    await $ns.gang['createGang']('Slum Snakes');
    await ns.sleep(1000);
  }

  const readyForAscension = async (name: string, gangInfo: GangGenInfo) => {
    const ascension = await $ns.gang['getAscensionResult'](name);
    if (ascension == null) return false;
    const skills = ['agi', 'cha', 'def', 'dex', 'hack', 'str'] as const;
    if (!skills.some((s) => ascension[s] >= 1.1)) return false;
    return ascension.respect / gangInfo.respect < 0.15;
  };

  const needsTraining = (member: GangMemberInfo) => {
    const { str, def, dex, agi } = member;
    return [str, def, dex, agi].some((x) => x < 1000);
  };

  let lastLoop = Date.now();

  while (true) {
    ns.clearLog();
    const loopTime = Date.now() - lastLoop + 'ms';
    lastLoop = Date.now();

    // Recruit as many members as possible
    while (await $ns.gang['recruitMember'](crypto.randomUUID()));

    const gangInfo = await $ns.gang['getGangInformation']();
    const allGangInfo = await $ns.gang['getAllGangInformation']();
    const gangName = gangInfo.faction;
    const memberNames = await $ns.gang['getMemberNames']();
    const readyMembers = [];

    // Report gang income to other processes
    putMoneyData(ns, { gangIncome: gangInfo.moneyGainRate * 5 });

    const memberInfo: Record<string, GangMemberInfo> = {};
    for (const name of memberNames) {
      memberInfo[name] = await $ns.gang['getMemberInformation'](name);
      if (await readyForAscension(name, gangInfo)) {
        await $ns.gang['ascendMember'](name);
      }
      if (needsTraining(memberInfo[name])) {
        await $ns.gang['setMemberTask'](name, 'Train Combat');
      } else {
        readyMembers.push(name);
      }
    }

    const assignNext = async (members: string[], task: string) => {
      if (members.length > 0) {
        await $ns.gang['setMemberTask'](members.shift()!, task);
        return true;
      }
      return false;
    };

    const assignAll = async (members: string[], task: string) => {
      while (await assignNext(members, task));
    };

    const totalLevels = (name: string) => {
      const { str, def, dex, agi } = memberInfo[name];
      return str + def + dex + agi;
    };

    const respect = async (name: string) => memberInfo[name].earnedRespect;

    const { territory, power } = allGangInfo[gangName];
    const winRates = getFightWinRates(gangName, allGangInfo);
    const shouldFite = territory < 0.99 && winRates.every((rate) => rate > 0.65);

    await $ns.gang['setTerritoryWarfare'](shouldFite);

    readyMembers.sort(by((name) => -respect(name)));
    if (gangInfo.territory < 1) await assignNext(readyMembers, 'Territory Warfare');
    if (gangInfo.wantedPenalty > 1) {
      await assignAll(readyMembers, 'Vigilante Justice');
    } else if (memberNames.length < 12) {
      await assignAll(readyMembers, 'Human Trafficking');
    } else {
      readyMembers.sort(by(totalLevels));
      await assignNext(readyMembers, 'Train Combat');
      if (gangInfo.territory < 1 && needsPower(gangName, allGangInfo)) {
        if (memberNames.length === 12) await assignNext(readyMembers, 'Human Trafficking');
        await assignAll(readyMembers, 'Territory Warfare');
      } else {
        await assignNext(readyMembers, 'Human Trafficking');
        await assignNext(readyMembers, 'Vigilante Justice');
        if (isRepBound(ns)) await assignAll(readyMembers, 'Terrorism');
        else await assignAll(readyMembers, 'Human Trafficking');
      }
    }

    ns.print(
      '\n' +
        table(ns, null, [
          [' LOOP TIME', loopTime],
          [' POWER', ns.format.number(power)],
          [' TERR', ns.format.number(territory)],
          [' WIN %', winRates.map((r) => ~~(r * 100)).join(',')],
          [' Need power?', needsPower(gangName, allGangInfo) ? 'Yes' : 'No'],
          [' FIGHT?', shouldFite ? 'Yes' : 'No'],
        ]),
    );
    ns.print('\n');

    await ns.gang.nextUpdate();
  }
}
