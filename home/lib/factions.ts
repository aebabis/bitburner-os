const EARLY_FACTIONS = [
  'CyberSec',
  'Tian Di Hui',
  'Netburners',
] as FactionName[];
const HACKING_GROUPS = [
  'NiteSec',
  'The Black Hand',
  'BitRunners',
] as FactionName[];
const ENDGAME_FACTIONS = [
  'The Covenant',
  'Daedalus',
  'Illuminati',
] as FactionName[];

export const STORY_FACTIONS = [
  ...EARLY_FACTIONS,
  ...HACKING_GROUPS,
  ...ENDGAME_FACTIONS,
] as FactionName[];

const MEGACORPORATIONS = [
  'ECorp',
  'MegaCorp',
  'KuaiGong International',
  'Four Sigma',
  'NWO',
  'Blade Industries',
  'OmniTek Incorporated',
  'Bachman & Associates',
  'Clarke Incorporated',
  'Fulcrum Secret Technologies',
] as FactionName[];

export const CRIMINAL_ORGANIZATIONS = [
  'Slum Snakes',
  'Tetrads',
  'Silhouette',
  'Speakers for the Dead',
  'The Dark Army',
  'The Syndicate',
] as FactionName[];

export const CITY_FACTIONS = [
  'Sector-12',
  'Chongqing',
  'New Tokyo',
  'Ishima',
  'Aevum',
  'Volhaven',
] as FactionName[];

export const FACTIONS = [
  ...STORY_FACTIONS,
  ...MEGACORPORATIONS,
  ...CRIMINAL_ORGANIZATIONS,
  ...CITY_FACTIONS,
] as FactionName[];
