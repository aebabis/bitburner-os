import { putPlayerData  } from './lib/data-store';

const CRIMES = [
  'Shoplift',
  'Rob store',
  'Mug someone',
  'Larceny',
  'Deal Drugs',
  'Bond Forgery',
  'Traffick illegal Arms',
  'Homicide',
  'Grand theft Auto',
  'Kidnap and Ransom',
  'Assassinate',
  'Heist'
];

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const crimeStats = CRIMES.map((name) => {
        const stats = ns.getCrimeStats(name);
        const { money, time } = stats;
        const chance = ns.getCrimeChance(name);
        return ({
            ...stats, chance, expectedValue: chance * money / time,
        })
    });
    putPlayerData({ crimeStats });
}