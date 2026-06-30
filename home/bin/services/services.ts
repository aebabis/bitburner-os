import { AnyHostService, Service } from '../../lib/service';
import { getStaticData } from '../../lib/data-store';
import { CRIMINAL_ORGANIZATIONS } from '../../lib/factions';
import { getGoals } from '../../lib/goals/goals';

const isRemoteApiConnected = () => {
  const elem = eval('doc' + 'ument').querySelector('svg[aria-label^="Remote API"]');
  if (elem) {
    const label = elem.getAttribute('aria-label');
    return label?.match('Online');
  }
};

export const getAllServices = (ns: NS, player: (_ns: NS) => Player) => {
  ns.disableLog('ALL');
  const { purchasedServerCosts, resetInfo } = getStaticData(ns);
  const { disableGang, disableCorporation } = resetInfo.bitNodeOptions;
  const { currentNode, ownedSF, ownedAugs } = resetInfo;
  const stockConstants = ns.stock.getConstants();
  const stockStarterCost = stockConstants.MarketDataTixApi4SCost + stockConstants.TixApiCost;

  const always = () => true;
  const not = (predicate: () => boolean) => () => !predicate();
  const hasNode = (num: number) => currentNode === num || ownedSF.has(num);

  const money = () => player(ns).money ?? 0;
  const factions = () => player(ns).factions ?? [];

  const hacknetAvailable = ![8].includes(currentNode);
  const playerLikesHacknet = false;

  const gangKarma = currentNode === 2 ? 0 : -54000;
  const mustSelfFund = currentNode !== 3;
  const corpCost = mustSelfFund ? 150e9 : 0;
  const isCriminal = (faction: FactionName) => CRIMINAL_ORGANIZATIONS.includes(faction);

  // Predicates for service viability (relevance).
  // services that are not useful with current BN/SFs do not appear in the dashboard
  const useWolf = () => hasNode(8);
  const hasAngel = () => ownedSF.has(1);
  const hasThief = () => !hasNode(5);
  const gangsAvailable = () => hasNode(2) && !disableGang && currentNode !== 8;
  const corpAllowed = () => !disableCorporation && currentNode !== 8;
  const hasSingularity = () => hasNode(4);
  const enableHacknet = () => hacknetAvailable && playerLikesHacknet;
  const enableCorp = () => corpAllowed() && (currentNode === 3 || ownedSF.get(3) === 3);
  const hasSimulacrum = () => ownedAugs.has("The Blade's Simulacrum");
  const preferAngel = () => ns.fileExists('Formulas.exe', 'home');
  const inBladeNode = () => [6, 7].includes(currentNode);

  // Predicates for starting services
  const useAngel = () => preferAngel() || !hasThief;
  const useThief = () => !preferAngel() || !hasAngel;
  const canPurchaseServers = () => money() >= purchasedServerCosts[4];
  const couldTrade = () => ns.stock.has4SDataTixApi() || money() >= stockStarterCost;
  const gangReady = () => factions().some(isCriminal) && ns.heart.break() <= gangKarma;
  const corpReady = () =>
    ns.corporation.hasCorporation() ||
    (ns.corporation.canCreateCorporation(mustSelfFund) === 'Success' && money() >= corpCost);
  const preferBlade = () => inBladeNode() && getGoals(ns).prerequisites('BLADES_JOIN').length > 0;
  const useBlade = () => preferBlade() || hasSimulacrum();
  const canWork = () => !preferBlade() || hasSimulacrum();
  const canShare = () => player(ns).skills.hacking > 100;
  const hasDarkscape = () => ns.fileExists('DarkscapeNavigator.exe', 'home');

  const services = [
    Service(ns, always, always)('/bin/planner.ts', 'home'),
    AnyHostService(ns, hasSingularity, canWork)('/bin/self/love.ts'),
    AnyHostService(ns)('/bin/access.ts'),
    AnyHostService(ns, hasAngel, useAngel)('/bin/angel.ts'),
    AnyHostService(ns, hasThief, useThief)('/bin/thief.ts'),
    AnyHostService(ns, always, canPurchaseServers, { interval: 1000 })('/bin/sysadmin.ts'),
    AnyHostService(ns)('/bin/dashboard.ts'),
    AnyHostService(ns)('/bin/contracts/freelancer.ts'),
    AnyHostService(ns, useWolf)('/bin/nerd.ts'),
    AnyHostService(ns, not(useWolf), couldTrade)('/bin/broker/trader.ts'),
    AnyHostService(ns, inBladeNode, useBlade)('/bin/blades/burners.ts'),
    AnyHostService(ns, enableHacknet)('/bin/hacknet.ts'),
    AnyHostService(ns, gangsAvailable, gangReady)('/bin/gang/don.ts'),
    AnyHostService(ns, enableCorp, corpReady)('/bin/corp/corp.ts'),
    AnyHostService(ns, hasSingularity, always)('/bin/self/control.ts'),
    AnyHostService(ns, not(hasSingularity))('/bin/hinter.ts'),
    AnyHostService(ns, not(hasSingularity))('/bin/trailblazer.ts'),
    Service(ns, always, isRemoteApiConnected)('/bin/nvim.ts', 'home'),
    AnyHostService(ns, always, canShare)('/bin/share.ts'),
    AnyHostService(ns)('/bin/stalker.ts'),
    Service(ns, always, hasDarkscape)('/bin/dnet/dnet.ts', 'home'),
  ];
  if (currentNode === 3) {
    const corpIndex = services.findIndex((service) => service.script === '/bin/corp/corp.ts');
    const corp = services.splice(corpIndex, 1)[0];
    const accessIndex = services.findIndex((service) => service.script === '/bin/access.ts');
    services.splice(accessIndex + 1, 0, corp);
  }
  return services;
};
