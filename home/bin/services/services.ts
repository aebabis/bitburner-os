import { AnyHostService } from '../../lib/service';
import { getStaticData, getRamData } from '../../lib/data-store';
import { CRIMINAL_ORGANIZATIONS } from '../../lib/factions';

const isRemoteApiConnected = () => {
  const elem = eval('doc' + 'ument').querySelector(
    'svg[aria-label^="Remote API"]',
  );
  if (elem) {
    const label = elem.getAttribute('aria-label');
    return label?.match('Online');
  }
};

const mostRootRam = (/** @type {NS} */ ns) => {
  const { rootServers = [] } = getRamData(ns);
  return Math.max(
    0,
    ...rootServers.map(
      (/** @type {{maxRam: number}} */ server) => server.maxRam,
    ),
  );
};

/** @param {NS} ns
 *  @param {((ns: NS) => Player)} [player]
 **/
export const getViableServices = (ns: NS, player) => {
  ns.disableLog('ALL');
  const { requiredJobRam, requiredAugRam, purchasedServerCosts, resetInfo } =
    getStaticData(ns);

  /** @param {number} num */
  const hasNode = (num) =>
    resetInfo.currentNode === num || resetInfo.ownedSF.has(num);
  const gangsAvailable = hasNode(2) && !resetInfo.bitNodeOptions.disableGang;
  const corpAvailable =
    hasNode(3) && !resetInfo.bitNodeOptions.disableCorporation;
  const hasSingularity = hasNode(4);

  const money = () => (player && player(ns).money) ?? 0;
  const factions = () => (player && player(ns).factions) ?? [];
  const canPurchaseServers = () => money() >= purchasedServerCosts[4];
  const couldTrade = () => ns.stock.hasTixApiAccess() || money() >= 5.2e9;
  const canAutopilot = () =>
    hasSingularity && requiredAugRam <= mostRootRam(ns);
  const isCriminal = (/** @type {string} */ faction) =>
    CRIMINAL_ORGANIZATIONS.includes(faction);
  const inCriminalFaction = () => factions().some(isCriminal);
  const corpReady = () => {
    const selfFund = resetInfo.currentNode !== 3;
    return (
      ns.corporation.hasCorporation() ||
      (requiredJobRam < mostRootRam(ns) &&
        ns.corporation.canCreateCorporation(selfFund) === 'Success')
    );
  };

  /* eslint-disable no-unexpected-multiline */
  const tasks = [
    AnyHostService(ns)('/bin/access.ts'),
    AnyHostService(ns)('/bin/hacknet.ts'),
    AnyHostService(ns)('/bin/thief.ts'),
    AnyHostService(ns, canPurchaseServers, 1000)('/bin/sysadmin.ts'),
    AnyHostService(ns)('/bin/dashboard.ts'),
    AnyHostService(ns)('/bin/accountant.ts'),
    AnyHostService(ns)('/bin/contracts/freelancer.ts'),
    AnyHostService(ns)('/bin/share.ts'),
    AnyHostService(ns)('/bin/stalker.ts'),
    AnyHostService(ns, couldTrade)('/bin/broker/broker.ts'),
    AnyHostService(ns, isRemoteApiConnected)('/bin/nvim.ts'),
  ];

  if (gangsAvailable)
    tasks.push(AnyHostService(ns, inCriminalFaction)('/bin/gang/mob-boss.ts'));

  if (corpAvailable)
    tasks.push(
      AnyHostService(ns, corpReady)('/bin/corporation/corporation.ts'),
    );

  if (hasSingularity) {
    tasks.push(
      AnyHostService(ns, canAutopilot)('/bin/self/aug/augment.ts'),
      AnyHostService(ns, canAutopilot)('/bin/self/work.ts'),
      AnyHostService(ns, canAutopilot)('/bin/self/control.ts'),
      AnyHostService(ns, canAutopilot)('/bin/self/tor.ts'),
      AnyHostService(ns, canAutopilot)('/bin/self/liaison.ts'),
    );
  } else {
    tasks.push(
      AnyHostService(ns)('/bin/hinter.ts'),
      AnyHostService(ns)('/bin/trailblazer.ts'),
    );
  }
  return tasks;
};
