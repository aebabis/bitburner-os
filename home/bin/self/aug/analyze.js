import { CITY_FACTIONS } from "../../../lib/factions";
import { getStaticData, getPlayerData, putStaticData } from "../../../lib/data-store";
import { selectAugmentations } from "../../../lib/aug-select";

/** @param {NS} ns */
export const analyzeAugData = (ns) => {
  const augData = getStaticData(ns);
  const { factionRep = {}, purchasedAugmentations = [] } = getPlayerData(ns);
  const cityFaction = ns
    .getPlayer()
    .factions.find((faction) => CITY_FACTIONS.includes(faction));
  const alreadyHave = [...(augData.ownedAugmentations ?? []), ...purchasedAugmentations];
  const { faction, augmentations } = selectAugmentations(
    alreadyHave,
    augData,
    cityFaction,
    factionRep,
  );
  putStaticData(ns, { targetFaction: faction, targetAugmentations: augmentations });
};

/** @param {NS} ns */
export async function main(ns) {
  analyzeAugData(ns);
}
