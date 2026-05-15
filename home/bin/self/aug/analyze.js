import { CITY_FACTIONS } from "../../../lib/factions";
import { getStaticData, putStaticData } from "../../../lib/data-store";
import { selectAugmentations } from "../../../lib/aug-select";

/** @param {NS} ns */
export const analyzeAugData = (ns) => {
  const augData = getStaticData(ns);
  const cityFaction = ns
    .getPlayer()
    .factions.find((faction) => CITY_FACTIONS.includes(faction));
  const { faction, augmentations } = selectAugmentations(
    augData.ownedAugmentations,
    augData,
    cityFaction,
  );
  putStaticData(ns, { targetFaction: faction, targetAugmentations: augmentations });
};

/** @param {NS} ns */
export async function main(ns) {
  analyzeAugData(ns);
}
