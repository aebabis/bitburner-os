import { AnyHostService, Service } from '../../lib/service';
import { getStaticData, getRamData } from '../../lib/data-store';
import { CRIMINAL_ORGANIZATIONS } from '../../lib/factions';
import { hasBladeburnerReadyMults } from '../blades/is-ready';

const isRemoteApiConnected = () => {
  const elem = eval('doc' + 'ument').querySelector(
    'svg[aria-label^="Remote API"]',
  );
  if (elem) {
    const label = elem.getAttribute('aria-label');
    return label?.match('Online');
  }
};

const mostRootRam = (ns: NS) => {
  const { rootServers = [] } = getRamData(ns) || {};
  return Math.max(
    0,
    ...rootServers.map((server: { maxRam: number }) => server.maxRam),
  );
};

export const getAllServices = (ns: NS, player: (_ns: NS) => Player) => {
  ns.disableLog('ALL');
  const { requiredJobRam, requiredAugRam, purchasedServerCosts, resetInfo } =
    getStaticData(ns);

  const hasNode = (num: number) =>
    resetInfo.currentNode === num || resetInfo.ownedSF.has(num);
  const hacknetAvailable = ![8].includes(resetInfo.currentNode);
  const playerLikesHacknet = false;
  const gangsAvailable =
    hasNode(2) &&
    !resetInfo.bitNodeOptions.disableGang &&
    ![8].includes(resetInfo.currentNode);
  const corpAvailable =
    hasNode(3) &&
    !resetInfo.bitNodeOptions.disableCorporation &&
    ![8].includes(resetInfo.currentNode);
  const hasSingularity = hasNode(4);

  const money = () => player(ns).money ?? 0;
  const factions = () => player(ns).factions ?? [];
  const canPurchaseServers = () => money() >= purchasedServerCosts[4];
  const couldTrade = () => ns.stock.hasTixApiAccess() || money() >= 5.2e9;
  const canAutopilot = () =>
    hasSingularity && requiredAugRam <= mostRootRam(ns);
  const isCriminal = (faction: FactionName) =>
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
  const useWolf = () => hasNode(8);
  const hasAngel = resetInfo.ownedSF.has(1);
  const hasThief = !hasNode(5);
  const preferAngel = () => ns.fileExists('Formulas.exe', 'home');
  const useAngel = () => preferAngel() || !hasThief;
  const useThief = () => !preferAngel() || !hasAngel;
  const useBlade = () =>
    resetInfo.currentNode === 6 && hasBladeburnerReadyMults(player(ns));
  const hasSimulacrum = () => resetInfo.ownedAugs.has("The Blade's Simulacrum");
  const canWork = () => canAutopilot() && (!useBlade() || hasSimulacrum());

  return [
    AnyHostService(ns)('/bin/access.ts'),
    AnyHostService(ns, useAngel, 5000, () => hasAngel)('/bin/angel.ts'),
    AnyHostService(ns, useThief, 5000, () => hasThief)('/bin/thief.ts'),
    AnyHostService(ns, canPurchaseServers, 1000)('/bin/sysadmin.ts'),
    AnyHostService(ns)('/bin/dashboard.ts'),
    AnyHostService(ns)('/bin/contracts/freelancer.ts'),
    AnyHostService(ns, () => true, 5000, useWolf)('/bin/nerd.ts'),
    AnyHostService(
      ns,
      couldTrade,
      5000,
      () => !useWolf(),
    )('/bin/broker/broker.ts'),
    AnyHostService(
      ns,
      useBlade,
      5000,
      () => resetInfo.currentNode === 6,
    )('/bin/blades/blades.ts'),
    AnyHostService(
      ns,
      () => true,
      5000,
      () => hacknetAvailable && playerLikesHacknet,
    )('/bin/hacknet.ts'),
    AnyHostService(
      ns,
      inCriminalFaction,
      5000,
      () => gangsAvailable,
    )('/bin/gang/mob-boss.ts'),
    AnyHostService(
      ns,
      corpReady,
      5000,
      () => corpAvailable,
    )('/bin/corporation/corporation.ts'),
    AnyHostService(
      ns,
      canAutopilot,
      5000,
      () => hasSingularity,
    )('/bin/self/aug/augment.ts'),
    AnyHostService(
      ns,
      canAutopilot,
      5000,
      () => hasSingularity,
    )('/bin/self/control.ts'),
    AnyHostService(
      ns,
      canAutopilot,
      5000,
      () => hasSingularity,
    )('/bin/self/tor.ts'),
    AnyHostService(
      ns,
      canWork,
      5000,
      () => hasSingularity,
    )('/bin/self/work.ts'),
    AnyHostService(
      ns,
      () => true,
      5000,
      () => !hasSingularity,
    )('/bin/hinter.ts'),
    AnyHostService(
      ns,
      () => true,
      5000,
      () => !hasSingularity,
    )('/bin/trailblazer.ts'),
    Service(ns, isRemoteApiConnected)('/bin/nvim.ts', 'home'),
    AnyHostService(ns)('/bin/share.ts'),
    AnyHostService(ns)('/bin/stalker.ts'),
  ];
};
