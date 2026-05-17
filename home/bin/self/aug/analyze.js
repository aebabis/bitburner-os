import { CITY_FACTIONS } from "../../../lib/factions";
import { getStaticData, getPlayerData, getMoneyData, putStaticData } from "../../../lib/data-store";
import { selectAugmentations } from "../../../lib/aug-select";

/** @param {NS} ns */
export const analyzeAugData = (ns) => {
  const augData = getStaticData(ns);
  const { factionRep = {}, purchasedAugmentations = [], activeRepRate = {} } = getPlayerData(ns);
  const cityFaction = ns
    .getPlayer()
    .factions.find((faction) => CITY_FACTIONS.includes(faction));
  const alreadyHave = [...(augData.ownedAugmentations ?? []), ...purchasedAugmentations];

  const moneyRate = getMoneyData(ns)?.referenceIncome ?? Infinity;
  const repRates = Object.values(activeRepRate);
  const repRate = repRates.length > 0 ? Math.max(...repRates) : 1;

  const { faction, augmentations } = selectAugmentations(
    alreadyHave,
    augData,
    cityFaction,
    factionRep,
    { moneyRate, repRate },
    ns.getPlayer().skills,
  );
  putStaticData(ns, { targetFaction: faction, targetAugmentations: augmentations });
};

/** @param {NS} ns */
export async function main(ns) {
  analyzeAugData(ns);
}
