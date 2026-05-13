import { AnyHostService } from "../../lib/service";
import { getTableString } from "../../lib/service-api";
import { getMoneyData } from "../../lib/data-store";
import { rmi } from "../../lib/rmi";

const isTixViable = (/** @type {NS} */ ns) => {
  const { costToAug } = getMoneyData(ns);
  const { money } = ns.getPlayer();
  if (costToAug == null || costToAug > 5e9) return money > 5e9;
  else return money - costToAug > 5e9;
};

const is4SViable = (/** @type {NS} */ ns) => {
  const { costToAug } = getMoneyData(ns);
  const { money } = ns.getPlayer();
  if (costToAug > 25e9) return money > 25e9;
  else return money - costToAug > 25e9;
};

const getTixApiAccess = async (/** @type {NS} */ ns) => {
  while (!ns.stock.hasTixApiAccess()) {
    while (!isTixViable(ns)) await ns.sleep(1000);
    if (!ns.stock.hasWseAccount())
      await rmi(ns)("/bin/broker/purchase.js", 1, "purchaseWseAccount");
    await rmi(ns)("/bin/broker/purchase.js", 1, "purchaseTixApi");
  }
};

const loadStaticStockData = (/** @type {NS} */ ns) => rmi(ns, true)("/bin/broker/load-stocks.js");

const attempt4SApiAccess = async (/** @type {NS} */ ns) => {
  if (is4SViable(ns))
    await rmi(ns)("/bin/broker/purchase.js", 1, "purchase4SMarketDataTixApi");
};

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const isTrendTrader = (/** @type {NS} */ ns) =>
    ns.stock.hasTixApiAccess() && !ns.stock.has4SDataTixApi();
  const isFourSTrader = (/** @type {NS} */ ns) =>
    ns.stock.hasTixApiAccess() && ns.stock.has4SDataTixApi();

  const trendTraderSubservice = AnyHostService(
    ns,
    isTrendTrader,
  )("/bin/broker/trader-trend.js");
  const fourSTraderSubservice = AnyHostService(
    ns,
    isFourSTrader,
  )("/bin/broker/trader-4s.js");
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
