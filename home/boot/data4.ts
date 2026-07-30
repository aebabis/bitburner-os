import { Augmentation, putStaticData } from '../lib/data-store';
import { defer } from './defer';
import { tprint } from './util';
import { STR } from '../lib/colors';
import { inPlace } from '../lib/in-place';

export async function main(ns: NS) {
  // Reserve RAM
  ns.singularity.getAugmentationsFromFaction;

  const $ = inPlace(ns);
  const factions = Object.values(ns.enums.FactionName) as FactionName[];
  const companies = Object.values(ns.enums.CompanyName) as CompanyName[];

  tprint(ns)(STR.BOLD + 'LOADING FACTION, AUGMENTATION, AND COMPANY DATA');

  tprint(ns)(STR + '  Loading Augmentation Names');
  const factionAugmentations = {} as Record<FactionName, string[]>;
  const augSet = new Set<string>(ns.getResetInfo().ownedAugs.keys());
  for (const faction of factions) {
    const list = await $.singularity['getAugmentationsFromFaction'](faction);
    factionAugmentations[faction] = list;
    for (const name of list) augSet.add(name);
  }
  const augmentationNames = [...augSet];

  tprint(ns)(STR + '  Loading Augmentation Prices');
  const augmentationPrices: Record<string, number> = {};
  for (const aug of augmentationNames)
    augmentationPrices[aug] = await $.singularity['getAugmentationBasePrice'](aug);

  tprint(ns)(STR + '  Loading Augmentation Rep Costs');
  const augmentationRepReqs: Record<string, number> = {};
  for (const aug of augmentationNames!)
    augmentationRepReqs[aug] = await $.singularity['getAugmentationRepReq'](aug);

  tprint(ns)(STR + '  Loading Augmentation PreReqs');
  const augmentationPrereqs: Record<string, string[]> = {};
  for (const aug of augmentationNames)
    augmentationPrereqs[aug] = await $.singularity['getAugmentationPrereq'](aug);

  tprint(ns)(STR + '  Loading Augmentation Stats');
  const augmentationStats: Record<string, Multipliers> = {};
  for (const aug of augmentationNames!)
    augmentationStats[aug] = await $.singularity['getAugmentationStats'](aug);

  tprint(ns)(STR + '  Constructing Augmentation Aggregates');
  const augmentations: Augmentation[] = [];
  for (const aug of augmentationNames!)
    augmentations.push({
      name: aug,
      price: augmentationPrices[aug],
      repReq: augmentationRepReqs[aug],
      prereqs: augmentationPrereqs[aug],
      stats: augmentationStats[aug],
      factions: await $.singularity['getAugmentationFactions'](aug),
    });

  tprint(ns)(STR + '  Loading Faction Favor');
  const factionFavor = {} as Record<FactionName, number>;
  for (const faction of factions)
    factionFavor[faction] = await $.singularity['getFactionFavor'](faction);

  tprint(ns)(STR + '  Loading Faction Requirements');
  const factionRequirements = {} as Record<FactionName, PlayerRequirement[]>;
  for (const faction of factions)
    factionRequirements[faction] = await $.singularity['getFactionInviteRequirements'](faction);

  tprint(ns)(STR + '  Loading Faction Work Types');
  const factionWorkTypes = {} as Record<FactionName, FactionWorkType[]>;
  for (const faction of factions)
    factionWorkTypes[faction] = await $.singularity['getFactionWorkTypes'](faction);

  tprint(ns)(STR + '  Loading Company Favor');
  const companyFavor = {} as Record<CompanyName, number>;
  for (const company of companies)
    companyFavor[company] = await $.singularity['getCompanyFavor'](company);

  tprint(ns)(STR + '  Loading Company Positions');
  const companyPositions = {} as Record<CompanyName, CompanyPositionInfo[]>;
  for (const company of companies) {
    const jobNames = await $.singularity['getCompanyPositions'](company);
    const positions = (companyPositions[company] = [] as CompanyPositionInfo[]);
    for (const positionName of jobNames)
      positions.push(await $.singularity['getCompanyPositionInfo'](company, positionName));
  }

  tprint(ns)(STR + '  Loading Crime Data');
  const crimeStats = {} as Record<CrimeType, CrimeStats>;
  for (const crimeType of Object.values(ns.enums.CrimeType)) {
    crimeStats[crimeType] = await $.singularity['getCrimeStats'](crimeType);
  }

  putStaticData(ns, {
    factionAugmentations,
    augmentations,
    augmentationNames,
    augmentationPrices,
    augmentationRepReqs,
    augmentationPrereqs,
    augmentationStats,
    factionFavor,
    factionRequirements,
    factionWorkTypes,
    companyFavor,
    companyPositions,
    crimeStats,
  });

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}
