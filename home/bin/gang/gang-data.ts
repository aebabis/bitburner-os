import { putGangData } from '../../lib/data-store';

export async function main(ns: NS) {
  putGangData(ns, {
    isReady: true,
    memberNames: [],
    gangInfo: ns.gang.getGangInformation(),
    allGangInfo: ns.gang.getAllGangInformation(),
  });
}
