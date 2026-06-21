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

export const $getActions = async (ns: NS) => {
  const ACTION_NAMES: Record<BladeburnerActionType, BladeburnerActionName[]> = {
    General: ns.bladeburner.getGeneralActionNames(),
    Contracts: ns.bladeburner.getContractNames(),
    Operations: ns.bladeburner.getOperationNames(),
    'Black Operations': ns.bladeburner.getBlackOpNames(),
  };
  const $ = runInPlace(ns, ns.pid);
  const actionPairs = Object.entries(ACTION_NAMES) as [
    BladeburnerActionType,
    BladeburnerActionName[],
  ][];
  const actionPlaceholder = () => ({
    estimatedChance: [0, 0] as [number, number],
    actionCountRemaining: 0,
  });
  const typeActions = (names: BladeburnerActionName[]) =>
    Object.fromEntries(names.map((name) => [name, actionPlaceholder()]));
  let result = Object.fromEntries(actionPairs.map(([type, names]) => [type, typeActions(names)]));
  result = await $((actions, result) => {
    for (const type of Object.keys(actions) as BladeburnerActionType[])
      for (const name of actions[type])
        result[type][name].estimatedChance = ns.bladeburner['getActionEstimatedSuccessChance'](
          type,
          name,
        );
    return result;
  })(ACTION_NAMES, result);
  result = await $((actions, result) => {
    for (const type of Object.keys(actions) as BladeburnerActionType[])
      for (const name of actions[type])
        result[type][name].actionCountRemaining = ns.bladeburner['getActionCountRemaining'](
          type,
          name,
        );
    return result;
  })(ACTION_NAMES, result);
  return result as Record<
    BladeburnerActionType,
    Record<BladeburnerActionName, ReturnType<typeof actionPlaceholder>>
  >;
};
export type BladeActions = Awaited<ReturnType<typeof $getActions>>;
export type BladeAction = Awaited<
  ReturnType<typeof $getActions>
>[BladeburnerActionType][BladeburnerActionName];

export const $getCities = async (ns: NS) => {
  const CITIES = Object.values(ns.enums.CityName);
  const $ = runInPlace(ns, ns.pid);
  const pop = await $((cities: CityName[]) => {
    return Object.fromEntries(
      cities.map((city) => [city, ns.bladeburner['getCityEstimatedPopulation'](city)]),
    ) as Record<CityName, number>;
  })(CITIES);
  const chaos = await $((cities: CityName[]) => {
    return Object.fromEntries(
      cities.map((city) => [city, ns.bladeburner['getCityChaos'](city)]),
    ) as Record<CityName, number>;
  })(CITIES);
  const comm = await $((cities: CityName[]) => {
    return Object.fromEntries(
      cities.map((city) => [city, ns.bladeburner['getCityCommunities'](city)]),
    ) as Record<CityName, number>;
  })(CITIES);
  const getCityStats = (city: CityName) => ({
    estimatedPopulation: pop[city],
    chaos: chaos[city],
    communities: comm[city],
  });
  return Object.fromEntries(CITIES.map((city) => [city, getCityStats(city)])) as Record<
    CityName,
    ReturnType<typeof getCityStats>
  >;
};
export type BladeCities = Awaited<ReturnType<typeof $getCities>>;

export const $upgradeSkills =
  (ns: NS) => async (actions: BladeActions, stamina: [number, number]) => {
    const $ = runInPlace(ns, ns.pid);

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

    let skills = SKILLS.map((name) => ({
      name,
      cost: 0,
      level: 0,
      limit: SKILL_LIMITS[name],
      upgradedThisTick: false,
    }));
    type Skills = typeof skills;
    skills = await $((skills: Skills) => {
      for (const skill of skills) skill.cost = ns.bladeburner['getSkillUpgradeCost'](skill.name);
      return skills;
    })(skills);
    skills = await $((skills: Skills) => {
      for (const skill of skills) skill.level = ns.bladeburner['getSkillLevel'](skill.name);
      return skills;
    })(skills);
    const neededSkills = skills
      .filter((skill) => skill.level < skill.limit)
      .filter((skill) => LIMITATIONS[skill.name]?.(ns) ?? true)
      .sort((a, b) => a.cost - b.cost)
      .map((skill) => skill.name);
    skills = await $((skills: Skills, neededSkills: BladeburnerSkillName[]) => {
      for (const skillName of neededSkills) {
        const skill = skills.find((skill) => skill.name === skillName)!;
        skill.upgradedThisTick = ns.bladeburner['upgradeSkill'](skillName);
      }
      return skills;
    })(skills, neededSkills);
    return skills;
  };
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
    const mostPopulated = CITIES.reduce((a, b) => {
      if (cities[a].chaos > 40 || cities[b].chaos > 40) {
        return cities[a].chaos > cities[b].chaos ? a : b;
      } else {
        return cities[a].estimatedPopulation > cities[b].estimatedPopulation ? a : b;
      }
    });
    ns.bladeburner['switchCity'](mostPopulated);
    return mostPopulated;
  });
