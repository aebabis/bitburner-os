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
export const getViableServices = (ns, player) => {
  ns.disableLog('ALL');
  const { requiredJobRam, purchasedServerCosts, resetInfo } = getStaticData(ns);

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
    hasSingularity && requiredJobRam <= mostRootRam(ns);
  const isCriminal = (/** @type {string} */ faction) =>
    CRIMINAL_ORGANIZATIONS.includes(faction);
  const inCriminalFaction = () => factions().some(isCriminal);
  const corpReady = () => {
    const selfFund = resetInfo.currentNode !== 3;
    return (
      ns.corporation.hasCorporation() ||
      ns.corporation.canCreateCorporation(selfFund) === 'Success'
    );
  };

  /* eslint-disable no-unexpected-multiline */
  const tasks = [
    AnyHostService(ns)('/bin/access.js'),
    AnyHostService(ns)('/bin/hacknet.js'),
    AnyHostService(ns)('/bin/thief.js'),
    AnyHostService(ns, canPurchaseServers, 1000)('/bin/sysadmin.js'),
    AnyHostService(ns)('/bin/dashboard.js'),
    AnyHostService(ns)('/bin/accountant.js'),
    AnyHostService(ns)('/bin/contracts/freelancer.js'),
    AnyHostService(ns)('/bin/share.js'),
    AnyHostService(ns)('/bin/stalker.js'),
    AnyHostService(ns, couldTrade)('/bin/broker/broker.js'),
    AnyHostService(ns, isRemoteApiConnected)('/bin/nvim.js'),
  ];

  if (gangsAvailable)
    tasks.push(AnyHostService(ns, inCriminalFaction)('/bin/gang/mob-boss.js'));

  if (corpAvailable)
    tasks.push(
      AnyHostService(ns, corpReady)('/bin/corporation/corporation.js'),
    );

  if (hasSingularity) {
    tasks.push(
      AnyHostService(ns, canAutopilot)('/bin/self/aug/augment.js'),
      AnyHostService(ns, canAutopilot)('/bin/self/work.js'),
      AnyHostService(ns, canAutopilot)('/bin/self/control.js'),
      AnyHostService(ns, canAutopilot)('/bin/self/tor.js'),
      AnyHostService(ns, canAutopilot)('/bin/self/liaison.js'),
    );
  } else {
    tasks.push(
      AnyHostService(ns)('/bin/hinter.js'),
      AnyHostService(ns)('/bin/trailblazer.js'),
    );
  }
  return tasks;
};
