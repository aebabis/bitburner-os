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
    const crimeStats = CRIMES.map(name => ({ name, ...ns.singularity.getCrimeStats(name) }));
    putPlayerData(ns, { crimeStats });
}