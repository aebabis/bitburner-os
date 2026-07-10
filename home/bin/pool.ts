import { putMoneyData } from '../lib/data-store';

export async function main(ns: NS) {
  ns.ui.openTail();

  let totalEarnings = 0;

  while (true) {
    ns.clearLog();
    while (ns.hacknet.spendHashes('Sell for Money')) {
      totalEarnings += 1e6; // getRunningScript doesn't seem to track this
    }
    const { onlineRunningTime, offlineRunningTime } = ns.getRunningScript()!;
    const hacknetIncome = totalEarnings / (onlineRunningTime + offlineRunningTime);
    putMoneyData(ns, { hacknetIncome });
    await ns.sleep(1000);
  }
}
