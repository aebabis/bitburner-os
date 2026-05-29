import { AnyHostService } from '../../lib/service';
import { getTableString } from '../../lib/service-api';
import { getGoals } from '../../lib/goals/goals';
import { rmi } from '../../lib/rmi';

const isTixViable = (ns: NS) => {
  const money = ns.getServerMoneyAvailable('home');
  const amg = getGoals(ns).find((g) => g.type === 'AUG_MONEY');
  if (amg == null || amg.isDone()) return money > 5e9;
  return money - (amg.requirement ?? 0) > 5e9;
};

const is4SViable = (ns: NS) => {
  const money = ns.getServerMoneyAvailable('home');
  const amg = getGoals(ns).find((g) => g.type === 'AUG_MONEY');
  if (amg == null || amg.isDone()) return money > 25e9;
  return money - (amg.requirement ?? 0) > 25e9;
};

const getTixApiAccess = async (ns: NS) => {
  while (!ns.stock.hasTixApiAccess()) {
    while (!isTixViable(ns)) await ns.sleep(1000);
    if (!ns.stock.hasWseAccount())
      await rmi(ns)('/bin/broker/purchase.ts', 1, 'purchaseWseAccount');
    await rmi(ns)('/bin/broker/purchase.ts', 1, 'purchaseTixApi');
  }
};

const loadStaticStockData = (ns: NS) =>
  rmi(ns, true)('/bin/broker/load-stocks.ts');

const attempt4SApiAccess = async (ns: NS) => {
  if (is4SViable(ns))
    await rmi(ns)('/bin/broker/purchase.ts', 1, 'purchase4SMarketDataTixApi');
};

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const isTrendTrader = () =>
    ns.stock.hasTixApiAccess() && !ns.stock.has4SDataTixApi();
  const isFourSTrader = () =>
    ns.stock.hasTixApiAccess() && ns.stock.has4SDataTixApi();

  const trendTraderSubservice = AnyHostService(
    ns,
    isTrendTrader,
  )('/bin/broker/trader-trend.ts');
  const fourSTraderSubservice = AnyHostService(
    ns,
    isFourSTrader,
  )('/bin/broker/trader-4s.ts');
  const services = [trendTraderSubservice, fourSTraderSubservice];

  await getTixApiAccess(ns);
  await loadStaticStockData(ns);

  while (true) {
    if (!ns.stock.has4SDataTixApi()) await attempt4SApiAccess(ns);

    for (const service of services) await service.check();

    ns.clearLog();
    ns.print(
      getTableString(
        ns,
        services.map((s) => s.toData()),
      ),
    );

    await ns.sleep(1000);
  }
}
