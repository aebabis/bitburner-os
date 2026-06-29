import { getStaticData, putPlayerData } from '../../lib/data-store';
import { getGoals, getTimeToMilestone, isRepBound } from '../../lib/goals/goals';
import { Goal, GoalType } from '../../lib/goals/nodes';
import { binomLowerBound, by, randPort } from '../../lib/util';
import { inPlace } from '../../lib/in-place';
import { shouldWorkHaveFocus as focus } from '../../lib/query-service';
import { $nmap } from '../../lib/nmap.rip';
import { $getBackdoorPath } from '../../lib/backdoor.rip';
import { $sing, $win } from '../../lib/sing.rip';

const TRAVEL_COST = 200_000;

const getSchool = (ns: NS, city: CityName) =>
  ({
    [ns.enums.CityName.Sector12]: ns.enums.LocationName.Sector12RothmanUniversity,
    [ns.enums.CityName.Chongqing]: null,
    [ns.enums.CityName.NewTokyo]: null,
    [ns.enums.CityName.Ishima]: null,
    [ns.enums.CityName.Aevum]: ns.enums.LocationName.AevumSummitUniversity,
    [ns.enums.CityName.Volhaven]: ns.enums.LocationName.VolhavenZBInstituteOfTechnology,
  })[city] || null;

const getGym = (ns: NS, city: CityName) =>
  ({
    [ns.enums.CityName.Sector12]: ns.enums.LocationName.Sector12IronGym,
    [ns.enums.CityName.Chongqing]: null,
    [ns.enums.CityName.NewTokyo]: null,
    [ns.enums.CityName.Ishima]: null,
    [ns.enums.CityName.Aevum]: ns.enums.LocationName.AevumCrushFitnessGym,
    [ns.enums.CityName.Volhaven]: ns.enums.LocationName.VolhavenMilleniumFitnessGym,
  })[city] || null;

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
    .filter((g) => g.faction && factions.includes(g.faction));
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
      (mostUrgentGoal.requirement ?? 0) -
      (await $.singularity['getFactionRep'](mostUrgentGoal.faction!));
    if (contenderRepNeeded > repNeeded) {
      mostUrgentGoal = contender;
      repNeeded = contenderRepNeeded;
    }
  }
  return mostUrgentGoal.faction!;
};

// const DEFAULT_WEIGHTS = {
//   money: 0,
//   hack_exp: 0,
//   str_exp: 0,
//   def_exp: 0,
//   dex_exp: 0,
//   agi_exp: 0,
//   cha_exp: 0,
//   kills: 0,
//   karma: 0,
// }

// type UtilityWeights = typeof DEFAULT_WEIGHTS;
//
// const UTILITY_WEIGHTS: Record<GoalType, (goal: Goal) => Partial<UtilityWeights>> = {
//   JOB_RAM: (goal: Goal) => {},
//   INSTALL: (goal: Goal) => {},
//   REEVALUATE: (goal: Goal) => {},
//   FACTION_JOIN: (goal: Goal) => {},
//   FACTION_REP: (goal: Goal) => {},
//   FACTION_FAVOR: (goal: Goal) => {},
//   BLADES_JOIN: (goal: Goal) => {},
//   COMBAT_LEVELS: (goal: Goal) => {},
//   HACKING_LEVEL: (goal: Goal) => {},
//   HACKING_XP: (goal: Goal) => {},
//   KILLS: (goal: Goal) => {},
//   KARMA: (goal: Goal) => {},
//   LOCATION: (goal: Goal) => {},
//   MONEY: (goal: Goal) => {},
//   AUG_MONEY: (goal: Goal) => {},
// }
//
// const getUtilityWeights = (goalTree: Goal) => {
//   // Each goal type that needs work outputs
//   // weighs the utility of actions proportional to the amount needed
//   const goals = goalTree.prerequisites()
//     .map((goal) => UTILITY_WEIGHTS[goal.type](goal))
//     .reduce((a, b) => ({
//       money: a.money + b.money,
//       hack_exp: 0,
//       str_exp: 0,
//       def_exp: 0,
//       dex_exp: 0,
//       agi_exp: 0,
//       cha_exp: 0,
//       kills: 0,
//       karma: 0,
//     }), DEFAULT_WEIGHTS);
// };

export async function main(ns: NS) {
  ns.disableLog('ALL');

  ns.singularity.commitCrime;

  const { resetInfo, factionFavor = {} as Record<FactionName, number> } = getStaticData(ns);
  const canMakeMoney = resetInfo.currentNode !== 8;

  const runPort = randPort();
  const $ = inPlace(ns, runPort);

  await ns.sleep(200); // Hack to prevent RAM contention during initial scheduler cycle
  await $.singularity['applyToCompany']("Joe's Guns", 'Employee');

  const CRIMES = {} as Record<CrimeType, CrimeStats>;
  for (const crimeName of Object.values(ns.enums.CrimeType)) {
    CRIMES[crimeName] = await $.singularity['getCrimeStats'](crimeName);
  }

  const goToGym = async (stat?: 'strength' | 'defense' | 'dexterity' | 'agility') => {
    if (!getGym(ns, ns.getPlayer().city)) {
      await $.singularity['travelToCity']('Sector-12');
    }
    const { city, skills } = ns.getPlayer();
    const statToTrain =
      stat ||
      (['strength', 'defense', 'dexterity', 'agility'] as const).reduce((s1, s2) =>
        skills[s1] < skills[s2] ? s1 : s2,
      );
    const gym = getGym(ns, city);
    if (gym) {
      await $.singularity['gymWorkout'](gym, ns.enums.GymType[statToTrain], focus(ns));
    }
  };

  const goToWork = async () => {
    await $.singularity['workForCompany']("Joe's Guns", focus(ns));
  };

  const makeMoney = async () => {
    const statForCrimeTraining = (['strength', 'defense', 'dexterity', 'agility'] as const).find(
      (stat) => ns.getPlayer().skills[stat] < 5,
    );
    const timeLimit = getTimeToMilestone(ns) || 60;
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
      await $.singularity['commitCrime'](crime, focus(ns));
    }
  };

  const factionWork = async (faction: FactionName) => {
    (await $.singularity['workForFaction'](faction, 'hacking', focus(ns))) ||
      (await $.singularity['workForFaction'](faction, 'field', focus(ns))) ||
      (await $.singularity['workForFaction'](faction, 'security', focus(ns)));
  };

  const { algorithms } = ns.enums.UniversityClassType;

  while (true) {
    const root = getGoals(ns);
    const prereqs = root.prerequisites();
    const findGoal = (type: GoalType) => prereqs.find((g) => g.type === type);
    const workFaction = await getWorkFaction($, root, ns.getPlayer().factions);

    const { city, money, skills } = ns.getPlayer();
    const school = getSchool(ns, city);
    const canGoToSchool = school != null || money >= TRAVEL_COST;
    const neededHackingLevel = findGoal('HACKING_LEVEL')?.requirement ?? 0;

    const hostnames = await $nmap(ns, runPort)();
    const backdoorPath = await $getBackdoorPath(ns, runPort)(hostnames);

    if (backdoorPath?.at(-1) === 'w0r1d_d43m0n') {
      await $win(ns, runPort);
    }
    await $sing(ns, runPort)(root);

    if (findGoal('HACKING_XP') && canGoToSchool) {
      if (getSchool(ns, city) == null) await $.singularity['travelToCity']('Sector-12');
      await $.singularity['universityCourse'](getSchool(ns, city)!, algorithms, focus(ns));
    } else if (skills.hacking < neededHackingLevel) {
      if (city !== 'Sector-12' && money >= TRAVEL_COST) {
        await $.singularity['travelToCity']('Sector-12');
      }
      await $.singularity['universityCourse'](getSchool(ns, city)!, algorithms, focus(ns));
    } else if (findGoal('COMBAT_LEVELS')?.isDone() === false) {
      await goToGym();
    } else if (findGoal('KILLS')?.isDone() === false || findGoal('KARMA')?.isDone() === false) {
      await $commitCrime('Homicide');
    } else if (!isRepBound(ns, root) && canMakeMoney) {
      await makeMoney();
    } else if (workFaction != null) {
      await factionWork(workFaction);
    } else {
      const locationGoal = findGoal('LOCATION');
      if (findGoal('COMBAT_LEVELS')?.isDone() === false) {
        await goToGym();
      } else if (locationGoal?.isDone() === false) {
        await $.singularity['travelToCity'](locationGoal.requirement as unknown as CityName);
      } else if (canMakeMoney) {
        await makeMoney();
      } else {
        // In BN8, grind favor
        const factionsByFavor = Object.entries(factionFavor)
          .sort(by(([, favor]) => -favor))
          .map(([faction]) => faction) as FactionName[];
        const grindFaction = factionsByFavor.find((faction) =>
          ns.getPlayer().factions.includes(faction),
        );
        if (grindFaction) {
          await factionWork(grindFaction);
        } else {
          makeMoney(); // For stats
        }
      }
    }
    const currentWork = JSON.parse(JSON.stringify(ns.singularity.getCurrentWork()));
    putPlayerData(ns, { currentWork });
    await ns.sleep(200);
  }
}
