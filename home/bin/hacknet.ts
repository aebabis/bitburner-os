import { getNodes, getBestPurchase } from '../lib/hacknet';
import { logger } from '../lib/logger';
import { getTimeToMilestone } from '../lib/goals/goals';
import { getMoneyData, putMoneyData } from '../lib/data-store';

export async function main(ns: NS) {
  const BUFFER_FACTOR = 1.2;
  let waitMessageShown = false;
  let lastMessageTime = 0;
  while (true) {
    const hacknetIncome = getNodes(ns)
      .map((node) => node.production)
      .reduce((a, b) => a + b, 0);
    const moneyData = getMoneyData(ns);
    putMoneyData(ns, { ...moneyData, hacknetIncome });

    if (moneyData.referenceIncome == null) {
      await ns.sleep(1000);
      continue;
    }

    try {
      const purchase = await getBestPurchase(ns);
      const timeToGoal = getTimeToMilestone(ns);
      if (timeToGoal != null && purchase.breakEvenTime > timeToGoal) {
        const hours = (purchase.breakEvenTime / 60 / 60).toFixed(2);
        ns.print(`Not purchasing hacknet upgrade. Break even time: ${hours}h`);
        await ns.sleep(10000);
        continue;
      }
      const money = ns.getServerMoneyAvailable('home');
      const factor = purchase.cost <= 1000 ? 1 : BUFFER_FACTOR;
      if (money >= factor * purchase.cost) {
        ns.print(`PO: ${purchase.toString()}`);
        purchase.purchase();
        waitMessageShown = false;
      } else {
        if (!waitMessageShown && Date.now() - lastMessageTime > 10000) {
          await logger(ns).log(`WA: ${purchase.toString()}`);
          ns.print(`WA: ${purchase.toString()}`);
          waitMessageShown = true;
          lastMessageTime = Date.now();
        }
        await ns.sleep(1000);
      }
    } catch (error) {
      await logger(ns).error(error);
      await ns.sleep(1000);
    }
  }
}
