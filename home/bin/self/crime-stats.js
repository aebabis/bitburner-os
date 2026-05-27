import { putPlayerData } from '../../lib/data-store';

const CRIMES = [
  'Shoplift',
  'Rob Store',
  'Mug',
  'Larceny',
  'Deal Drugs',
  'Bond Forgery',
  'Traffick Arms',
  'Homicide',
  'Grand Theft Auto',
  'Kidnap',
  'Assassination',
  'Heist',
];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const crimeStats = CRIMES.map((name) => ({
    name,
    ...ns.singularity.getCrimeStats(name),
  }));
  putPlayerData(ns, { crimeStats });
}
