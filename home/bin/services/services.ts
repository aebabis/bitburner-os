import { AnyHostService, ChainedService, Service } from '../../lib/service';
import { getStaticData, getRamData } from '../../lib/data-store';
import { CRIMINAL_ORGANIZATIONS } from '../../lib/factions';
import { hasBladeburnerReadyMults } from '../blades/is-ready';

const isRemoteApiConnected = () => {
  const elem = eval('doc' + 'ument').querySelector('svg[aria-label^="Remote API"]');
  if (elem) {
    const label = elem.getAttribute('aria-label');
    return label?.match('Online');
  }
};

const mostRootRam = (ns: NS) => {
  const { rootServers = [] } = getRamData(ns) || {};
  return Math.max(0, ...rootServers.map((server: { maxRam: number }) => server.maxRam));
};

export const getAllServices = (ns: NS, player: (_ns: NS) => Player) => {
  ns.disableLog('ALL');
  const { requiredAugRam, purchasedServerCosts, resetInfo } = getStaticData(ns);
  const { disableGang, disableCorporation } = resetInfo.bitNodeOptions;

  const always = () => true;
  const not = (predicate: () => boolean) => () => !predicate;
  const hasNode = (num: number) => resetInfo.currentNode === num || resetInfo.ownedSF.has(num);

  const money = () => player(ns).money ?? 0;
  const factions = () => player(ns).factions ?? [];

  const hacknetAvailable = ![8].includes(resetInfo.currentNode);
  const playerLikesHacknet = false;

  const gangKarma = resetInfo.currentNode === 2 ? 0 : -54000;
  const mustSelfFund = resetInfo.currentNode !== 3;
  const isCriminal = (faction: FactionName) => CRIMINAL_ORGANIZATIONS.includes(faction);

  // Predicates for service viability (relevance).
  // services that are not useful with current BN/SFs do not appear in the dashboard
  const useWolf = () => hasNode(8);
  const hasAngel = () => resetInfo.ownedSF.has(1);
  const hasThief = () => !hasNode(5);
  const gangsAvailable = () => hasNode(2) && !disableGang && resetInfo.currentNode !== 8;
  const corpAvailable = () => hasNode(3) && !disableCorporation && resetInfo.currentNode !== 8;
  const hasSingularity = () => hasNode(4);
  const enableHacknet = () => hacknetAvailable && playerLikesHacknet;
  const enableCorp = () => corpAvailable() && resetInfo.ownedSF.get(3) === 3;
  const hasSimulacrum = () => resetInfo.ownedAugs.has("The Blade's Simulacrum");
  const preferAngel = () => ns.fileExists('Formulas.exe', 'home');
  const inBladeNode = () => [6, 7].includes(resetInfo.currentNode);

  // Predicates for starting services
  const useAngel = () => preferAngel() || !hasThief;
  const useThief = () => !preferAngel() || !hasAngel;
  const canPurchaseServers = () => money() >= purchasedServerCosts[4];
  const couldTrade = () => ns.stock.hasTixApiAccess() || money() >= 5.2e9;
  const gangReady = () => factions().some(isCriminal) && ns.heart.break() <= gangKarma;
  const corpReady = () =>
    ns.corporation.hasCorporation() ||
    ns.corporation.canCreateCorporation(mustSelfFund) === 'Success';
  const canAutopilot = () => hasSingularity() && requiredAugRam <= mostRootRam(ns);
  const preferBlade = () => inBladeNode() && hasBladeburnerReadyMults(player(ns));
  const useBlade = () => preferBlade() || hasSimulacrum();
  const canWork = () => !preferBlade() || hasSimulacrum();
  const canShare = () => player(ns).skills.hacking > 100;

  return [
    AnyHostService(ns, hasSingularity, canWork)('/bin/self/love.ts'),
    AnyHostService(ns)('/bin/access.ts'),
    AnyHostService(ns, hasAngel, useAngel)('/bin/angel.ts'),
    AnyHostService(ns, hasThief, useThief)('/bin/thief.ts'),
    AnyHostService(ns, always, canPurchaseServers, { interval: 1000 })('/bin/sysadmin.ts'),
    AnyHostService(ns)('/bin/dashboard.ts'),
    AnyHostService(ns)('/bin/contracts/freelancer.ts'),
    AnyHostService(ns, useWolf)('/bin/nerd.ts'),
    AnyHostService(ns, not(useWolf), couldTrade)('/bin/broker/broker.ts'),
    ChainedService(ns, inBladeNode, useBlade)('/bin/blades/blades.ts'),
    AnyHostService(ns, enableHacknet)('/bin/hacknet.ts'),
    AnyHostService(ns, gangsAvailable, gangReady)('/bin/gang/don.ts'),
    AnyHostService(ns, enableCorp, corpReady)('/bin/corporation/corporation.ts'),
    AnyHostService(ns, hasSingularity, canAutopilot)('/bin/self/control.ts'),
    AnyHostService(ns, hasSingularity, canAutopilot)('/bin/self/tor.ts'),
    AnyHostService(ns, not(hasSingularity))('/bin/hinter.ts'),
    AnyHostService(ns, not(hasSingularity))('/bin/trailblazer.ts'),
    Service(ns, always, isRemoteApiConnected)('/bin/nvim.ts', 'home'),
    AnyHostService(ns, always, canShare)('/bin/share.ts'),
    AnyHostService(ns)('/bin/stalker.ts'),
  ];
};
