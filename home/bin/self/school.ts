import { getGoals } from '../../lib/goals/goals';
import { shouldWorkHaveFocus } from '../../lib/query-service';
import { putPlayerData } from '../../lib/data-store';

/** @param {NS} ns @param {CityName} city */
const getSchool = (ns, city) =>
  ({
    [ns.enums.CityName.Sector12]:
      ns.enums.LocationName.Sector12RothmanUniversity,
    [ns.enums.CityName.Chongqing]: null,
    [ns.enums.CityName.NewTokyo]: null,
    [ns.enums.CityName.Ishima]: null,
    [ns.enums.CityName.Aevum]: ns.enums.LocationName.AevumSummitUniversity,
    [ns.enums.CityName.Volhaven]:
      ns.enums.LocationName.VolhavenZBInstituteOfTechnology,
  })[city] || null;

/** @param {NS} ns */
export async function main(ns) {
  const { skills, city } = ns.getPlayer();
  const hackingGoal = getGoals(ns).find(
    (g) => g.type === 'HACKING_LEVEL' && !g.isDone(),
  );
  const levelReq = hackingGoal?.requirement ?? 0;
  const school = getSchool(ns, city);
  if (skills.hacking < levelReq && school != null) {
    ns.singularity.universityCourse(
      school,
      ns.enums.UniversityClassType.algorithms,
      shouldWorkHaveFocus(ns),
    );
  }
  putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
  const cutoff = Date.now() + 10000;
  while (ns.getPlayer().skills.hacking < levelReq && Date.now() < cutoff)
    await ns.sleep(50);
}
