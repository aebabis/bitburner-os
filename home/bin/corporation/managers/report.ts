import { putCorpReports } from '../../../lib/data-store';

export const startReport = (ns: NS, division: string) => {
  const entries = [[division.toUpperCase()]];
  return {
    add: (content: string[]) => entries.push(content),
    send: () => putCorpReports(ns, { [division]: entries }),
  };
};
