import { putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { STR } from '../lib/colors';
import { inPlace } from '../lib/in-place';

export async function main(ns: NS) {
  // Reserve RAM
  ns.singularity.getAugmentationsFromFaction;

  const factions = Object.values(ns.enums.FactionName) as FactionName[];
  const companies = Object.values(ns.enums.CompanyName) as CompanyName[];

  tprint(ns)(STR.BOLD + 'LOADING FACTION, AUGMENTATION, AND COMPANY DATA');

  tprint(ns)(STR + '  Loading Augmentation Names');
  const factionAugmentations = {} as Record<FactionName, string[]>;
  const augSet = new Set<string>();
  for (const faction of factions) {
    const list = await inPlace(ns).singularity['getAugmentationsFromFaction'](faction);
    factionAugmentations[faction] = list;
    for (const name of list) augSet.add(name);
  }
  const augmentations = [...augSet];

  tprint(ns)(STR + '  Loading Augmentation Prices');
  const augmentationPrices: Record<string, number> = {};
  for (const aug of augmentations)
    augmentationPrices[aug] = await inPlace(ns).singularity['getAugmentationBasePrice'](aug);

  tprint(ns)(STR + '  Loading Augmentation Rep Costs');
  const augmentationRepReqs: Record<string, number> = {};
  for (const aug of augmentations!)
    augmentationRepReqs[aug] = await inPlace(ns).singularity['getAugmentationRepReq'](aug);

  tprint(ns)(STR + '  Loading Augmentation PreReqs');
  const augmentationPrereqs: Record<string, string[]> = {};
  for (const aug of augmentations)
    augmentationPrereqs[aug] = await inPlace(ns).singularity['getAugmentationPrereq'](aug);

  tprint(ns)(STR + '  Loading Augmentation Stats');
  const augmentationStats: Record<string, Multipliers> = {};
  for (const aug of augmentations!)
    augmentationStats[aug] = await inPlace(ns).singularity['getAugmentationStats'](aug);

  tprint(ns)(STR + '  Loading Faction Favor');
  const factionFavor = {} as Record<FactionName, number>;
  for (const faction of factions)
    factionFavor[faction] = await inPlace(ns).singularity['getFactionFavor'](faction);

  tprint(ns)(STR + '  Loading Faction Requirements');
  const factionRequirements = {} as Record<FactionName, PlayerRequirement[]>;
  for (const faction of factions)
    factionRequirements[faction] =
      await inPlace(ns).singularity['getFactionInviteRequirements'](faction);

  tprint(ns)(STR + '  Loading Faction Work Types');
  const factionWorkTypes = {} as Record<FactionName, FactionWorkType[]>;
  for (const faction of factions)
    factionWorkTypes[faction] = await inPlace(ns).singularity['getFactionWorkTypes'](faction);

  tprint(ns)(STR + '  Loading Company Favor');
  const companyFavor = {} as Record<CompanyName, number>;
  for (const company of companies)
    companyFavor[company] = await inPlace(ns).singularity['getCompanyFavor'](company);

  tprint(ns)(STR + '  Loading Company Positions');
  const companyPositions = {} as Record<CompanyName, CompanyPositionInfo[]>;
  for (const company of companies) {
    const jobNames = await inPlace(ns).singularity['getCompanyPositions'](company);
    const positions = (companyPositions[company] = [] as CompanyPositionInfo[]);
    for (const positionName of jobNames) {
      positions.push(
        await inPlace(ns).singularity['getCompanyPositionInfo'](company, positionName),
      );
    }
  }

  putStaticData(ns, {
    factionAugmentations,
    augmentations,
    augmentationPrices,
    augmentationRepReqs,
    augmentationPrereqs,
    augmentationStats,
    factionFavor,
    factionRequirements,
    factionWorkTypes,
    companyFavor,
    companyPositions,
  });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}
