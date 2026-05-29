import { putCorpReports } from '../../../lib/data-store';

export const startReport = (ns: NS, division: string) => {
  const entries = [[division.toUpperCase()]];
  return {
    /** @param {string[]} content */
    add: (content) => entries.push(content),
    send: () => putCorpReports(ns, { [division]: entries }),
  };
};
