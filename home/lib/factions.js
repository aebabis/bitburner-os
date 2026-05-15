/** @type {FactionName[]} */
const EARLY_FACTIONS = ["CyberSec", "Tian Di Hui", "Netburners"];
/** @type {FactionName[]} */
const HACKING_GROUPS = ["NiteSec", "The Black Hand", "BitRunners"];
/** @type {FactionName[]} */
const ENDGAME_FACTIONS = ["The Covenant", "Daedalus", "Illuminati"];

/** @type {FactionName[]} */
export const STORY_FACTIONS = [
  ...EARLY_FACTIONS,
  ...HACKING_GROUPS,
  ...ENDGAME_FACTIONS,
];

/** @type {FactionName[]} */
const MEGACORPORATIONS = [
  "ECorp",
  "MegaCorp",
  "KuaiGong International",
  "Four Sigma",
  "NWO",
  "Blade Industries",
  "OmniTek Incorporated",
  "Bachman & Associates",
  "Clarke Incorporated",
  "Fulcrum Secret Technologies",
];

/** @type {FactionName[]} */
export const CRIMINAL_ORGANIZATIONS = [
  "Slum Snakes",
  "Tetrads",
  "Silhouette",
  "Speakers for the Dead",
  "The Dark Army",
  "The Syndicate",
];

/** @type {FactionName[]} */
export const CITY_FACTIONS = [
  "Sector-12",
  "Chongqing",
  "New Tokyo",
  "Ishima",
  "Aevum",
  "Volhaven",
];

/** @type {FactionName[]} */
export const FACTIONS = [
  ...STORY_FACTIONS,
  ...MEGACORPORATIONS,
  ...CRIMINAL_ORGANIZATIONS,
  ...CITY_FACTIONS,
];
