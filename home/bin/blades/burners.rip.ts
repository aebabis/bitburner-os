import { inPlace, runInPlace } from '../../lib/in-place';
import { shouldWorkHaveFocus } from '../../lib/query-service';

export const $train =
  (ns: NS) => async (stat?: 'strength' | 'defense' | 'dexterity' | 'agility') => {
    const focus = shouldWorkHaveFocus(ns);
    await runInPlace(
      ns,
      ns.pid,
    )((focus: boolean, stat?: 'strength' | 'defense' | 'dexterity' | 'agility') => {
      const stats = ['strength', 'defense', 'dexterity', 'agility'] as const;
      const { city, skills } = ns['getPlayer']();
      const lowestStat = stats.reduce((s1, s2) => (skills[s1] < skills[s2] ? s1 : s2));
      const statToTrain = ns.enums.GymType[stat || lowestStat];
      if (city !== 'Sector-12') ns.singularity['travelToCity']('Sector-12');
      ns.singularity['gymWorkout']('Powerhouse Gym', statToTrain, focus);
    })(focus, stat);
  };

export const $getActions = async (ns: NS) =>
  runInPlace(
    ns,
    ns.pid,
  )(() => {
    const ACTION_NAMES: Record<BladeburnerActionType, BladeburnerActionName[]> = {
      General: ns.bladeburner.getGeneralActionNames(),
      Contracts: ns.bladeburner.getContractNames(),
      Operations: ns.bladeburner.getOperationNames(),
      'Black Operations': ns.bladeburner.getBlackOpNames(),
    };

    const actionPairs = Object.entries(ACTION_NAMES) as [
      BladeburnerActionType,
      BladeburnerActionName[],
    ][];

    type BladeAction = {
      estimatedChance: [number, number];
      actionCountRemaining: number;
      duration: number;
    };

    const getActions = (type: BladeburnerActionType, names: BladeburnerActionName[]) =>
      Object.fromEntries(
        names.map((name) => [
          name,
          {
            estimatedChance: ns.bladeburner['getActionEstimatedSuccessChance'](type, name),
            actionCountRemaining: ns.bladeburner['getActionCountRemaining'](type, name),
          },
        ]),
      ) as Record<BladeburnerActionName, BladeAction>;

    return Object.fromEntries(
      actionPairs.map(([type, names]) => [type, getActions(type, names)]),
    ) as Record<BladeburnerActionType, ReturnType<typeof getActions>>;
  })();
export type BladeActions = Awaited<ReturnType<typeof $getActions>>;
export type BladeAction = Awaited<
  ReturnType<typeof $getActions>
>[BladeburnerActionType][BladeburnerActionName];

export const $getCities = async (ns: NS) =>
  runInPlace(
    ns,
    ns.pid,
  )(() => {
    const CITIES = Object.values(ns.enums.CityName);

    const getCityStats = (city: CityName) => ({
      estimatedPopulation: ns.bladeburner['getCityEstimatedPopulation'](city),
      chaos: ns.bladeburner['getCityChaos'](city),
      communities: ns.bladeburner['getCityCommunities'](city),
    });

    const cities = Object.fromEntries(CITIES.map((city) => [city, getCityStats(city)])) as Record<
      CityName,
      ReturnType<typeof getCityStats>
    >;

    return cities;
  })();
export type BladeCities = Awaited<ReturnType<typeof $getCities>>;

export const $upgradeSkills = (ns: NS) =>
  runInPlace(
    ns,
    ns.pid,
  )((actions: BladeActions, stamina: [number, number]) => {
    const SKILL_LIMITS: Record<BladeburnerSkillName, number> = {
      "Blade's Intuition": Infinity,
      Cloak: 25,
      'Short-Circuit': 25,
      'Digital Observer': Infinity,
      Tracer: 10,
      Overclock: Infinity,
      Reaper: Infinity,
      'Evasive System': Infinity,
      Datamancer: 0,
      "Cyber's Edge": 0,
      'Hands of Midas': 0,
      Hyperdrive: 20,
    };

    type SkillCondition = (ns: NS) => boolean;

    const LIMITATIONS: Partial<Record<BladeburnerSkillName, SkillCondition>> = {
      'Digital Observer': () => {
        const [low, high] = actions.Operations.Investigation.estimatedChance;
        return (low + high) / 2 > 0.7;
      },
      Overclock: () => stamina[0] / stamina[1] > 0.75,
    };

    const SKILLS = Object.keys(SKILL_LIMITS) as BladeburnerSkillName[];

    const skills = SKILLS.map((name) => ({
      name,
      cost: ns.bladeburner['getSkillUpgradeCost'](name),
      level: ns.bladeburner['getSkillLevel'](name),
      limit: SKILL_LIMITS[name],
      upgradedThisTick: false,
    }));
    const neededSkills = skills
      .filter((skill) => skill.level < skill.limit)
      .filter((skill) => LIMITATIONS[skill.name]?.(ns) ?? true)
      .sort((a, b) => a.cost - b.cost);
    const upgraded = new Set<BladeburnerSkillName>();
    for (const skill of neededSkills) {
      if (ns.bladeburner['upgradeSkill'](skill.name)) {
        upgraded.add(skill.name);
        skill.upgradedThisTick = true;
      }
    }
    return skills;
  });
export type BladeSkills = Awaited<ReturnType<ReturnType<typeof $upgradeSkills>>>;

export const $startAction =
  (ns: NS) => async (type: BladeburnerActionType, name: BladeburnerActionName) => {
    const currentAction = await inPlace(ns, ns.pid).bladeburner['getCurrentAction']();
    if (currentAction && currentAction.type === type && currentAction.name === name) {
      return;
    }
    await inPlace(ns, ns.pid).bladeburner['startAction'](type, name);
  };

export const $getCurrentAction = async (ns: NS) => {
  const currentAction = await inPlace(ns, ns.pid).bladeburner['getCurrentAction']();
  if (currentAction === null) {
    return null;
  }
  const { name, type } = currentAction;
  const time = await inPlace(ns, ns.pid).bladeburner['getActionCurrentTime']();
  const duration = await inPlace(ns, ns.pid).bladeburner['getActionTime'](
    type as BladeburnerActionType,
    name as BladeburnerActionName,
  );
  return {
    name,
    type,
    time,
    duration,
  };
};
export type BladeCurrentAction = Awaited<ReturnType<typeof $getCurrentAction>>;

export const $selectCity = (ns: NS) =>
  runInPlace(
    ns,
    ns.pid,
  )((cities: BladeCities) => {
    const CITIES = Object.values(ns.enums.CityName);
    const mostPopulated = CITIES.reduce((a, b) =>
      cities[a].estimatedPopulation > cities[b].estimatedPopulation ? a : b,
    );
    ns.bladeburner['switchCity'](mostPopulated);
    return mostPopulated;
  });
