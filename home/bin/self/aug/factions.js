export const STORY_FACTIONS = [
    'CyberSec',
    'Tian Di Hui',
    'Netburners',
    'NiteSec',
    'The Black Hand',
    'BitRunners',
    'The Covenant',
    'Daedalus',
    'Illuminati',
];

export const MEGACORPORATIONS = [
    'ECorp',
    'MegaCorp',
    'KuaiGong International',
    'Four Sigma',
    'NWO',
    'Blade Industries',
    'OmniTek Incorporated',
    'Bachman & Associates',
    'Clarke Incorporated',
    'Fulcrum Secret Technologies'
];

export const CRIMINAL_ORGANIZATIONS = [
    'Slum Snakes',
    'Tetrads',
    'Silhouette',
    'Speakers for the Dead',
    'The Dark Army',
    'The Syndicate',
];

export const CITY_FACTIONS = [
    'Sector-12',
    'Chongqing',
    'New Tokyo',
    'Ishima',
    'Aevum',
    'Volhaven'
];

export const FACTIONS = [
    ...STORY_FACTIONS,
    ...MEGACORPORATIONS,
    ...CRIMINAL_ORGANIZATIONS,
    ...CITY_FACTIONS
];

export const FACTION_LOCATIONS = {
    'Sector-12':     ['Sector-12'],
    'Chongqing':     ['Chongqing'],
    'New Tokyo':     ['New Tokyo'],
    'Ishima':        ['Ishima'],
    'Aevum':         ['Aevum'],
    'Volhaven':      ['Volhaven'],
    'Tian Di Hui':   ['Chongqing', 'New Tokyo', 'Ishima'],
    'Tetrads':       ['Chongqing', 'New Tokyo', 'Ishima'],
    'The Dark Army': ['Chongqing'],
    'The Syndicate': ['Aevum', 'Sector-12'],
};

export const COMBAT_REQUIREMENTS = {
    'The Covenant': 850,
    'Daedalus': 1500, // Or 2500 hacking
    'Illuminati': 1200,
    'Slum Snakes': 30,
    'Tetrads': 75,
    'Speakers for the Dead': 300,
    'The Dark Army': 300,
    'The Syndicate': 200
};

export const KARMA_REQUIREMENTS = {
    'Slum Snakes': 9,
    'Tetrads': 18,
    'Silhouette': 22,
    'Speakers for the Dead': 45,
    'The Dark Army': 45,
    'The Syndicate': 90,
};

export const AUGMENTATION_REQUIREMENTS = {
    'The Covenant': 20,
    'Daedalus': 30,
    'Illuminati': 30,
};

export default FACTIONS;