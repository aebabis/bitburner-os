import { putCorpReports } from '../../../lib/data-store';

/** @param {NS} ns @param {string} division */
export const startReport = (ns, division) => {
  const entries = [[division.toUpperCase()]];
  return {
    /** @param {string[]} content */
    add: (content) => entries.push(content),
    send: () => putCorpReports(ns, { [division]: entries }),
  };
};
