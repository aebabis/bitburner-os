import { getStaticData, putPlayerData } from '../../lib/data-store';
import { getGoals, getPlanningHorizon, isRepBound } from '../../lib/goals/goals';
import { Goal, GoalOfType, GoalType } from '../../lib/goals/nodes';
import { binomLowerBound, by } from '../../lib/util';
import { inPlace, runInPlace } from '../../lib/in-place';
import { $nmap } from '../../lib/nmap.rip';
import { $getBackdoorPath } from '../../lib/backdoor.rip';
import { $checkInstall, $sing, $win } from '../../lib/sing.rip';
import { makeAfkTracker } from '../../lib/afk';
import { formulas, hasFormulas } from '../../lib/formulas';
import { $join as $joinBladeburners } from '../blades/burners.rip';

const TRAVEL_COST = 200_000;

const getSchool = (ns: NS, city = ns.getPlayer().city) =>
  ({
    [ns.enums.CityName.Sector12]: ns.enums.LocationName.Sector12RothmanUniversity,
    [ns.enums.CityName.Chongqing]: null,
    [ns.enums.CityName.NewTokyo]: null,
    [ns.enums.CityName.Ishima]: null,
    [ns.enums.CityName.Aevum]: ns.enums.LocationName.AevumSummitUniversity,
    [ns.enums.CityName.Volhaven]: ns.enums.LocationName.VolhavenZBInstituteOfTechnology,
  })[city] || null;

const getGym = (ns: NS, city = ns.getPlayer().city) =>
  ({
    [ns.enums.CityName.Sector12]: ns.enums.LocationName.Sector12PowerhouseGym,
    [ns.enums.CityName.Chongqing]: null,
    [ns.enums.CityName.NewTokyo]: null,
    [ns.enums.CityName.Ishima]: null,
    [ns.enums.CityName.Aevum]: ns.enums.LocationName.AevumCrushFitnessGym,
    [ns.enums.CityName.Volhaven]: ns.enums.LocationName.VolhavenMilleniumFitnessGym,
  })[city] || null;

export async function main(ns: NS) {
  ns.disableLog('ALL');

  ns.singularity.commitCrime;

  const runPort = ns.pid;
  const $ = inPlace(ns, runPort);
  const $rip = runInPlace(ns, runPort);

  const { resetInfo, singularityData } = getStaticData(ns);
  if (singularityData == null) {
    while (true) {
      const [ramGoal] = getGoals(ns).prerequisites('HOME_RAM');
      if (ramGoal == null) {
        throw new Error('Augmentation data not loaded. Expected RAM goal');
      }
      if (ramGoal.isDone()) {
        const pid = await $rip(() => {
          ns['killall']('home', true);
          return ns['exec']('stop.ts', 'home', 1, 'start.ts');
        })();
        if (pid) return;
      } else {
        while (await $.singularity['upgradeHomeRam']());
        await ns.sleep(1000);
      }
    }
  }
  const { factionFavor, factionWorkTypes } = singularityData;
  const canMakeMoney = resetInfo.currentNode !== 8;

  const afkTracker = makeAfkTracker(ns);
  const focus = () => resetInfo.currentNode !== 8 && afkTracker.timeSinceAction() > 20000;

  if (resetInfo.currentNode === 8) {
    while (ns.getServerMaxRam('home') < 256 && (await $.singularity['upgradeHomeRam']()));
  }

  await ns.sleep(200); // Hack to prevent RAM contention during initial scheduler cycle
  await $.singularity['applyToCompany']("Joe's Guns", 'Employee');

  const CRIMES = {} as Record<CrimeType, CrimeStats>;
  for (const crimeName of Object.values(ns.enums.CrimeType)) {
    CRIMES[crimeName] = await $.singularity['getCrimeStats'](crimeName);
  }

  /**
   * Returns the faction with the largest remaining rep gap that the player
   * is already a member of, or null if no rep work is needed.
   */
  const getWorkFaction = async (
    $: ReturnType<typeof inPlace>,
    root: Goal,
    factions: FactionName[],
  ): Promise<FactionName | null> => {
    const possibleGoals = root
      .prerequisites()
      .filter((g) => !g.isDone())
      .filter((g) => g.type === 'FACTION_REP' || g.type === 'FACTION_FAVOR')
      .filter((g) => g.faction && factions.includes(g.faction))
      .filter((g) => factionWorkTypes[g.faction].length > 0);
    let mostUrgentGoal = possibleGoals.shift();
    if (mostUrgentGoal == null) {
      return null;
    }
    let repNeeded =
      (mostUrgentGoal.requirement ?? 0) -
      (await $.singularity['getFactionRep'](mostUrgentGoal.faction!));
    let contender;
    while ((contender = possibleGoals.shift())) {
      const contenderRepNeeded =
        (contender.requirement ?? 0) - (await $.singularity['getFactionRep'](contender.faction!));
      if (contenderRepNeeded > repNeeded) {
        mostUrgentGoal = contender;
        repNeeded = contenderRepNeeded;
      }
    }
    return mostUrgentGoal.faction!;
  };

  const goToGym = async (stat?: 'strength' | 'defense' | 'dexterity' | 'agility') => {
    if (!getGym(ns)) {
      await $.singularity['travelToCity']('Sector-12');
    }
    const { skills } = ns.getPlayer();
    const statToTrain =
      stat ||
      (['strength', 'defense', 'dexterity', 'agility'] as const).reduce((s1, s2) =>
        skills[s1] < skills[s2] ? s1 : s2,
      );
    const gym = getGym(ns);
    const currentWork = ns.singularity.getCurrentWork();
    const alreadyTrainingStat =
      currentWork?.type === 'CLASS' &&
      currentWork.location === gym &&
      currentWork.classType === ns.enums.GymType[statToTrain];
    if (gym != null && !alreadyTrainingStat) {
      await $.singularity['gymWorkout'](gym, ns.enums.GymType[statToTrain], focus());
    }
  };

  const goToWork = async () => {
    await $.singularity['workForCompany']("Joe's Guns", focus());
  };

  const makeMoney = async () => {
    const statForCrimeTraining = (['strength', 'defense', 'dexterity', 'agility'] as const).find(
      (stat) => ns.getPlayer().skills[stat] < 5,
    );
    const timeLimit = getPlanningHorizon(ns) || 60;
    if (statForCrimeTraining != null) {
      if (ns.getPlayer().money > 5000) await goToGym(statForCrimeTraining);
      else await goToWork();
    } else {
      const CONFIDENCE = 0.9;
      const crimes = Object.entries(CRIMES).filter(
        ([, stats]) => stats.time <= timeLimit * 1000,
      ) as [CrimeType, CrimeStats][];
      if (crimes.length === 0) {
        await goToWork();
        return;
      }
      const score = async ([type, stats]: [CrimeType, CrimeStats]) => {
        const chance = await $.singularity['getCrimeChance'](type);
        const n = Math.floor((timeLimit * 1000) / stats.time);
        const lb = binomLowerBound(n, chance, CONFIDENCE);
        return lb > 0 ? lb * stats.money : chance * stats.money;
      };
      let bestCrime = crimes.shift()!;
      let bestScore = await score(bestCrime);
      let otherCrime;
      while ((otherCrime = crimes.shift())) {
        const otherScore = await score(otherCrime);
        if (otherScore > bestScore) {
          bestCrime = otherCrime;
          bestScore = otherScore;
        }
      }
      await $commitCrime(bestCrime[0]);
    }
  };

  const $commitCrime = async (crime: CrimeType) => {
    const { crimeType } = (ns.singularity.getCurrentWork() || {}) as CrimeTask;
    if (crimeType !== crime) {
      await $.singularity['commitCrime'](crime, focus());
    }
  };

  const $goToSchool = async () => {
    const { city, money } = ns.getPlayer();
    if (city !== 'Sector-12' && money >= TRAVEL_COST) {
      await $.singularity['travelToCity']('Sector-12');
    }
    const school = getSchool(ns);
    if (school == null) return;
    const currentWork = ns.singularity.getCurrentWork();
    if (
      currentWork?.type !== 'CLASS' ||
      currentWork.classType !== algorithms ||
      currentWork.location !== school
    ) {
      await $.singularity['universityCourse'](school, algorithms, focus());
    }
  };

  const factionWork = async (player: Player, faction: FactionName) => {
    const form = hasFormulas(ns) ? ns.formulas : formulas(ns);
    const workTypes = factionWorkTypes[faction];
    if (workTypes.length === 0) {
      return false;
    }
    const { workType } = workTypes
      .map((workType) => ({
        workType,
        reputation: form.work.factionGains(player, workType, 0).reputation,
      }))
      .reduce((a, b) => (a.reputation > b.reputation ? a : b));
    const { factionName, factionWorkType } = (ns.singularity.getCurrentWork() ||
      {}) as FactionWorkTask;
    if (faction === factionName && workType === factionWorkType) return;
    return await $.singularity['workForFaction'](faction, workType, focus());
  };

  const { algorithms } = ns.enums.UniversityClassType;

  const selectPlayerAction = async (rootGoal: Goal) => {
    const reduce = (root: Goal): Goal[] => {
      const relevant = new Set<Goal>([root]);
      for (const goal of root.deps) {
        if (goal.isDone()) continue;
        let target = goal;
        if (goal.type === 'EITHER') {
          target = goal.deps.reduce((a, b) => (a.timeToComplete() < b.timeToComplete() ? a : b));
        }
        for (const child of reduce(target)) relevant.add(child);
      }
      return [...relevant];
    };

    const relevantGoals = reduce(rootGoal);
    const findGoal = <T extends GoalType>(type: T) =>
      relevantGoals.find((g): g is GoalOfType<T> => g.type === type);
    const combatGoal = findGoal('COMBAT_LEVEL');
    const bladesJoinGoal = findGoal('BLADES_JOIN');
    const workFaction = await getWorkFaction($, rootGoal, ns.getPlayer().factions);

    const { money, skills } = ns.getPlayer();
    const school = getSchool(ns);
    const canGoToSchool = school != null || money >= TRAVEL_COST;
    const neededHackingLevel = findGoal('HACKING_LEVEL')?.requirement ?? 0;
    const currentWork = ns.singularity.getCurrentWork();

    if (currentWork?.type === 'GRAFTING') {
      return;
    }

    if (bladesJoinGoal != null && bladesJoinGoal.deps.every((dep) => dep.isDone())) {
      await $joinBladeburners(ns);
    }

    if (findGoal('HACKING_XP') && canGoToSchool) {
      await $goToSchool();
    } else if (skills.hacking < neededHackingLevel && canGoToSchool) {
      await $goToSchool();
    } else if (combatGoal != null) {
      await goToGym(combatGoal.stat);
    } else if (findGoal('KILLS')?.isDone() === false || findGoal('KARMA')?.isDone() === false) {
      await $commitCrime('Homicide');
    } else if (!isRepBound(ns, rootGoal) && workFaction != null && canMakeMoney) {
      await makeMoney();
    } else if (workFaction != null) {
      await factionWork(ns.getPlayer(), workFaction);
    } else {
      const locationGoals = rootGoal.prerequisites('LOCATION');
      if (locationGoals.length > 0 && !locationGoals.some((g) => g.isDone())) {
        await $.singularity['travelToCity'](locationGoals[0].city);
      } else if (canMakeMoney) {
        await makeMoney();
      } else {
        const achievements = await $.singularity['getUnlockedAchievements']();
        if (!achievements.includes('KARMA_1000000')) {
          await $commitCrime('Homicide');
        } else {
          // In BN8, grind rep or favor
          const joinGoal = rootGoal.prerequisites('FACTION_JOIN')[0];
          if (joinGoal && joinGoal.isDone()) {
            await factionWork(ns.getPlayer(), joinGoal.faction);
          } else {
            const factionsByFavor = Object.entries(factionFavor)
              .sort(by(([, favor]) => -favor))
              .map(([faction]) => faction) as FactionName[];
            const grindFaction = factionsByFavor.find((faction) =>
              ns.getPlayer().factions.includes(faction),
            );
            if (grindFaction) {
              await factionWork(ns.getPlayer(), grindFaction);
            } else {
              await makeMoney(); // For stats
            }
          }
        }
      }
    }
  };

  while (true) {
    const rootGoal = getGoals(ns);

    const hostnames = await $nmap(ns, runPort)();
    const backdoorPath = await $getBackdoorPath(ns, runPort)(hostnames);

    if (backdoorPath?.at(-1) === 'w0r1d_d43m0n') {
      // TODO: consider adding sleeve memory purchase path here for robustness
      await $win(ns, runPort);
    }
    await $checkInstall(ns, runPort)(rootGoal);

    if (ns.singularity.getCurrentWork()) ns.singularity.setFocus(focus());
    await $sing(ns, runPort)(rootGoal);

    if (ns.getServerMaxRam('home') <= 64) {
      await $.singularity['upgradeHomeRam']();
    }

    await selectPlayerAction(rootGoal);

    const currentWork = JSON.parse(JSON.stringify(ns.singularity.getCurrentWork()));
    putPlayerData(ns, { currentWork });
    await ns.sleep(200);
  }
}
