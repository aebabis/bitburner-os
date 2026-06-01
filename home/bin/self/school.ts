import { shouldWorkHaveFocus } from '../../lib/query-service';

const getSchool = (ns: NS, city: CityName) =>
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

export async function main(ns: NS) {
  const { city } = ns.getPlayer();
  const school = getSchool(ns, city);
  if (school != null) {
    ns.singularity.universityCourse(
      school,
      ns.enums.UniversityClassType.algorithms,
      shouldWorkHaveFocus(ns),
    );
  }
}
