import { THE_BLADE } from '../../etc/augmentations';
import { makeAfkTracker } from '../../lib/afk';
import { putPlayerData } from '../../lib/data-store';
import { getGoals } from '../../lib/goals/goals';
import { inPlace } from '../../lib/in-place';
import { $checkInstall, $sing, $win } from '../../lib/sing.rip';
import {
  $join,
  $getActions,
  $getCities,
  $getCurrentAction,
  $selectCity,
  $startAction,
  $gymTrain,
  $upgradeSkills,
  BladeAction,
  BladeActions,
} from './burners.rip';
import { openTail, showInfo } from './report';

const getNextMission =
  (ns: NS) =>
  async (
    actions: BladeActions,
    currentBlackOp: BladeburnerBlackOpName | null,
    rank: number,
  ): Promise<[BladeburnerActionType, BladeburnerActionName] | null> => {
    const canDo = (action: BladeAction, chance: number) =>
      action.actionCountRemaining >= 1 && action.estimatedChance[0] >= chance;
    const $ = inPlace(ns, ns.pid);
    if (currentBlackOp != null) {
      const blackOpRank = await $.bladeburner['getBlackOpRank'](currentBlackOp);
      if (blackOpRank < rank && canDo(actions['Black Operations'][currentBlackOp], 0.8)) {
        return ['Black Operations', currentBlackOp];
      }
    }
    const operation = ns.bladeburner
      .getOperationNames()
      .filter((opName) => opName !== 'Raid') // I herd raids r bad
      .reverse()
      .find((operation) => canDo(actions['Operations'][operation], 0.7));
    if (operation) {
      return ['Operations', operation];
    }
    const contract = ns.bladeburner
      .getContractNames()
      .reverse()
      .find((contract) => canDo(actions['Contracts'][contract], 0.7));
    if (contract) {
      return ['Contracts', contract];
    }
    return null;
  };

const needsIntel = (actions: BladeActions) => {
  const missions = [
    ...Object.values(actions.Contracts),
    ...Object.values(actions.Operations),
    ...Object.values(actions['Black Operations']),
  ];
  return missions.some((mission) => {
    const [lower, upper] = mission.estimatedChance;
    const avg = (lower + upper) / 2;
    return avg > 0.7 && upper - lower > 0.1;
  });
};

const actionRecorder = (ns: NS, lastAugReset: number) => {
  const $ = inPlace(ns, ns.pid);
  let doingMissions = true;
  let repThisMissionCycle = 0;
  let missionCycleStart = Date.now();
  const $saveRepRate = async () => {
    const missionCycleTime = (Date.now() - missionCycleStart) / 1000;
    const augCycleTime = (Date.now() - lastAugReset) / 1000;
    const installRep = await $.singularity['getFactionRep']('Bladeburners');
    const installAvgRep = installRep / augCycleTime;
    const cycleAvgRep = repThisMissionCycle / missionCycleTime;
    const bladeburnerRepRate = Math.max(installAvgRep, cycleAvgRep);
    putPlayerData(ns, { bladeburnerRepRate });
  };
  type ActionDesc = { type: BladeburnerActionType; name: BladeburnerActionName };
  return async (action: ActionDesc | null) => {
    let expectedRepGain = 0;
    if (action) {
      const actionRepGain = await $.bladeburner['getActionRepGain'](action.type, action.name);
      const [lowChance, highChance] = await $.bladeburner['getActionEstimatedSuccessChance'](
        action.type,
        action.name,
      );
      const chance = (lowChance + highChance) / 2;
      expectedRepGain = chance * actionRepGain;
    }
    if (expectedRepGain === 0) {
      doingMissions = false;
    } else {
      if (!doingMissions) {
        await $saveRepRate();
        doingMissions = true;
        repThisMissionCycle = 0;
        missionCycleStart = Date.now();
      }
      repThisMissionCycle += expectedRepGain;
    }
  };
};

export async function main(ns: NS) {
  const $ = inPlace(ns, ns.pid);
  openTail(ns);

  typeof ns.singularity.getOwnedAugmentations;

  const afkTracker = makeAfkTracker(ns);
  const focus = () => afkTracker.timeSinceAction() > 20000;

  const { lastAugReset } = await $['getResetInfo']();
  const $recordAction = actionRecorder(ns, lastAugReset);

  const $start = async (type: BladeburnerActionType, name: BladeburnerActionName) => {
    if (await $startAction(ns)(type, name)) await $recordAction({ type, name });
  };
  const $train = async (stat?: 'strength' | 'defense' | 'dexterity' | 'agility') => {
    if (ns.singularity.getCurrentWork()?.type !== 'GRAFTING') {
      await $gymTrain(ns)(focus(), stat);
    }
    await $recordAction(null);
  };

  while (!(await $join(ns))) {
    await $train();
    await ns.sleep(1000);
  }

  const { ownedAugs } = await $['getResetInfo']();
  // Called again to account for SF7.3 giving augmentation on join
  const hasBlade = ownedAugs.has(THE_BLADE);

  while (true) {
    if (!hasBlade) {
      const goals = getGoals(ns);
      await $checkInstall(ns, ns.pid)(goals);
      await $sing(ns, ns.pid)(goals);
    }

    const actions = await $getActions(ns);
    const cities = await $getCities(ns);
    const stamina = await $.bladeburner['getStamina']();
    const rank = await $.bladeburner['getRank']();
    const skills = await $upgradeSkills(ns)(actions, stamina);
    const city = await $selectCity(ns)(cities);
    const currentBlackOp = ((await $.bladeburner['getNextBlackOp']()) || {}).name || null;
    const hasStaminaPenalty = stamina[0] * 2 < stamina[1];

    if (currentBlackOp == null) {
      await $win(ns, ns.pid);
    }
    const $wouldLoseProgress = async () => {
      const currentAction = await $getCurrentAction(ns);
      return currentAction != null && currentAction.time > 2000;
    };
    if (hasStaminaPenalty && !(await $wouldLoseProgress())) {
      await $.bladeburner['stopBladeburnerAction']();
      if (hasBlade) {
        await $start('General', 'Training');
      } else {
        await $train('agility');
      }
    } else if (cities[city].chaos > 10) {
      await $start('General', 'Diplomacy');
    } else {
      const mission = await getNextMission(ns)(actions, currentBlackOp, rank);
      if (mission) {
        const [type, name] = mission;
        await $start(type, name);
      } else if (needsIntel(actions)) {
        await $start('General', 'Field Analysis');
      } else if (hasBlade) {
        await $start('General', 'Training');
      } else {
        await $train();
      }
    }
    const currentAction = await $getCurrentAction(ns);
    showInfo(ns)(cities, skills, hasBlade, currentAction, city, currentBlackOp);
    if (ns.singularity.getCurrentWork()) ns.singularity.setFocus(focus());
    await ns.bladeburner.nextUpdate();
  }
}
