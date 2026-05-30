const EARLY_FACTIONS = ['CyberSec', 'Tian Di Hui', 'Netburners'] as const;
const HACKING_GROUPS = ['NiteSec', 'The Black Hand', 'BitRunners'] as const;
const ENDGAME_FACTIONS = ['The Covenant', 'Daedalus', 'Illuminati'] as const;

export const STORY_FACTIONS = [
  ...EARLY_FACTIONS,
  ...HACKING_GROUPS,
  ...ENDGAME_FACTIONS,
] as const;

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
] as const;

export const CRIMINAL_ORGANIZATIONS = [
  'Slum Snakes',
  'Tetrads',
  'Silhouette',
  'Speakers for the Dead',
  'The Dark Army',
  'The Syndicate',
] as const;

export const CITY_FACTIONS = [
  'Sector-12',
  'Chongqing',
  'New Tokyo',
  'Ishima',
  'Aevum',
  'Volhaven',
] as const;

export const FACTIONS = [
  ...STORY_FACTIONS,
  ...MEGACORPORATIONS,
  ...CRIMINAL_ORGANIZATIONS,
  ...CITY_FACTIONS,
] as const;
