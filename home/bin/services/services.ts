import { THE_BLADE } from '../../etc/augmentations';
import { AnyHostService, Service } from '../../lib/service';
import { getStaticData } from '../../lib/data-store';
import { getGoals } from '../../lib/goals/goals';
import { gangsAllowed, hasBitNode, usingCorp } from '../../lib/query-service';

const isRemoteApiConnected = () => {
  const elem = eval('doc' + 'ument').querySelector('svg[aria-label^="Remote API"]');
  if (elem) {
    const label = elem.getAttribute('aria-label');
    return label?.match('Online');
  }
};

export const getAllServices = (ns: NS, player: (_ns: NS) => Player) => {
  ns.disableLog('ALL');
  const staticData = getStaticData(ns);
  const { purchasedServerCosts, resetInfo } = staticData;
  const { currentNode, ownedSF, ownedAugs } = resetInfo;
  const stockConstants = ns.stock.getConstants();
  const stockStarterCost = stockConstants.TixApiCost + stockConstants.MarketDataTixApi4SCost;
  // SF5.2 grants Formulas.exe at the start of every run
  const hasPermanentFormulas = (ownedSF.get(5) ?? 0) >= 2;
  // SF7.3 grants The Blade's Simulacrum upon joining the Bladeburner division
  const hasPermanentBlade = (ownedSF.get(7) ?? 0) === 3;

  const always = () => true;
  const not = (predicate: () => boolean) => () => !predicate();
  const hasNode = (num: number) => hasBitNode(num, staticData);

  const money = () => player(ns).money ?? 0;
  const factions = () => player(ns).factions ?? [];

  const hasFormulas = () => ns.fileExists('Formulas.exe', 'home');
  const playerLikesHacknet = false;

  const gangKarma = currentNode === 2 ? 0 : -54000;
  const inCorpNode = currentNode === 3;
  const inWorstNode = () => currentNode === 8;
  const mustSelfFund = !inCorpNode;
  const corpCost = mustSelfFund ? 150e9 : 0;

  // Predicates for service viability (relevance).
  // services that are not useful with current BN/SFs do not appear in the dashboard
  const hasNerd = () => currentNode === 8 && !ns.stock.has4SDataTixApi();
  const hasAngel = () => ownedSF.has(1);
  const hasThief = () => !hasPermanentFormulas;
  const gangsAvailable = () => gangsAllowed(staticData);
  const hasSingularity = () => hasNode(4);
  const enablePool = () => hasNode(9) && currentNode !== 8;
  const enableHacknet = () => playerLikesHacknet && !enablePool() && currentNode !== 8;
  const enableCorp = () => usingCorp(staticData);
  const hasSimulacrum = () =>
    ownedAugs.has(THE_BLADE) || (hasPermanentBlade && ns.bladeburner.inBladeburner());
  const preferAngel = () => hasFormulas();
  const inBladeNode = () =>
    [6, 7].includes(currentNode) || (hasPermanentBlade && currentNode !== 8);
  const canStanek = () => hasNode(13) && currentNode !== 8;
  const canAutoGraft = () => hasNode(4) && hasNode(10);
  const hasSleeves = () => hasNode(10);

  // Predicates for starting services
  const useAngel = () => preferAngel() || !hasThief();
  const useThief = () => !preferAngel() || !hasAngel();
  const canPurchaseServers = () => money() >= purchasedServerCosts[4];
  const couldTrade = () =>
    !hasNerd() && (ns.stock.hasTixApiAccess() || money() >= stockStarterCost);
  const gangReady = () => factions().includes('Slum Snakes') && ns.heart.break() <= gangKarma;
  const corpReady = () =>
    ns.corporation.hasCorporation() ||
    (ns.corporation.canCreateCorporation(mustSelfFund) === 'Success' && money() >= corpCost);
  const buyingBlade = () =>
    getGoals(ns).actions.some((action) => action.type === 'BUY_AUG' && action.name === THE_BLADE);
  const preferBlade = () => inBladeNode() && buyingBlade();
  const useBlade = () => hasSimulacrum() || preferBlade();
  const canWork = () => hasSimulacrum() || !preferBlade();
  const canShare = () => player(ns).skills.hacking > 100;
  const hasDarkscape = () => ns.fileExists('DarkscapeNavigator.exe', 'home');

  const services = [
    Service(ns, always, always)('/bin/planner.ts', 'home'),
    AnyHostService(ns, inWorstNode)('/bin/casino.ts'),
    AnyHostService(ns, hasSingularity, canWork, { highPriority: true })('/bin/self/love.ts'),
    AnyHostService(ns)('/bin/access.ts'),
    AnyHostService(ns, hasAngel, useAngel)('/bin/angel.ts'),
    AnyHostService(ns, hasThief, useThief)('/bin/thief.ts'),
    AnyHostService(ns, always, canPurchaseServers, { interval: 1000 })('/bin/sysadmin.ts'),
    AnyHostService(ns)('/bin/dashboard.ts'),
    Service(ns, always, hasDarkscape)('/bin/dnet/dnet.ts', 'home'),
    AnyHostService(ns)('/bin/contracts/freelancer.ts'),
    AnyHostService(ns, enablePool, hasFormulas)('/bin/pool.ts'),
    AnyHostService(ns, hasNerd, always, { highPriority: true })('/bin/nerd.ts'),
    AnyHostService(ns, always, couldTrade)('/bin/broker/trader.ts'),
    AnyHostService(ns, inBladeNode, useBlade)('/bin/blades/burners.ts'),
    AnyHostService(ns, enableHacknet)('/bin/hacknet.ts'),
    AnyHostService(ns, gangsAvailable, gangReady)('/bin/gang/don.ts'),
    AnyHostService(ns, enableCorp, corpReady, { highPriority: inCorpNode })('/bin/corp/corp.ts'),
    AnyHostService(ns, hasSingularity, always)('/bin/self/control.ts'),
    AnyHostService(ns, not(hasSingularity))('/bin/hinter.ts'),
    AnyHostService(ns, not(hasSingularity))('/bin/trailblazer.ts'),
    Service(ns, always, isRemoteApiConnected)('/bin/nvim.ts', 'home'),
    AnyHostService(ns, always, canShare)('/bin/share.ts'),
    AnyHostService(ns, canStanek, always)('/bin/stanek.ts'),
    AnyHostService(ns, canAutoGraft, always)('/bin/grafting.ts'),
    AnyHostService(ns, hasSleeves, hasFormulas)('/bin/sleeves.ts'),
  ];
  const findServiceIndex = (script: string) =>
    services.findIndex((service) => service.script === script);
  const removeService = (script: string) => services.splice(findServiceIndex(script), 1)[0];
  const insertService = (service: (typeof services)[number], after?: string) => {
    const index = after ? findServiceIndex(after) + 1 : services.length;
    services.splice(index, 0, service);
  };
  if (currentNode === 3) {
    const corp = removeService('/bin/corp/corp.ts');
    insertService(corp, '/bin/access.ts');
  }
  if (ns.getServerMaxRam('home') >= 128) {
    services.push(removeService('/bin/angel.ts'));
    services.push(removeService('/bin/thief.ts'));
  }
  return services;
};
