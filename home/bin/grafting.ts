import { BRIGHT, C, INFO } from '../lib/colors';
import { getGoals } from '../lib/goals/goals';
import { table } from '../lib/table';
import { formatTime } from '../lib/util';
import { getGraftTargets } from '../lib/grafting';
import { getStaticData, putMoneyData, putPlayerData, putStaticData } from '../lib/data-store';
import { getAugEvaluator, getEntropyCost, getPlayerUtility } from '../lib/aug-weights';
import { setupTail } from '../lib/tail';

export async function main(ns: NS) {
  const { singularityData } = getStaticData(ns);
  if (singularityData == null) {
    throw new Error('grafting requires augmentation data to choose grafts');
  }
  putMoneyData(ns, { graftPriceReserve: 0 });

  ns.disableLog('ALL');
  setupTail(ns, { width: 775, height: 440, left: 0, bottom: 50 });

  const getInstallUtility = () => {
    const resetInfo = ns.getResetInfo();
    const scoreAug = getAugEvaluator(resetInfo, singularityData.augmentationStats);
    const goals = getGoals(ns);
    const ttc = goals.timeToComplete();
    if (scoreAug == null) return null;

    const augs = goals.actions
      .filter((action) => action.type === 'BUY_AUG')
      .map((action) => action.name);

    if (augs.length === 0) return null;

    const value = augs.map(scoreAug).reduce((a, b) => a + b, 0);
    return {
      value,
      utility: (1e3 * value) / ttc,
    };
  };

  // Safeguard heuristic to prevent otherwise-efficient grafting
  // when it is no longer needed.
  const closeToObjective = () => {
    // Currently only important in BN8 (sigh).
    return (
      ns.getResetInfo().currentNode === 8 &&
      getGoals(ns).prerequisites('FACTION_JOIN')[0]?.faction === 'Daedalus'
    );
  };

  const PURCHASE_WAITING_PERIOD = 10000;
  let pendingAug = '';
  let cooldownStart = 0;

  let mostRecentGraft = '';
  while (true) {
    ns.clearLog();
    const { money, city, entropy } = ns.getPlayer();
    const resetInfo = ns.getResetInfo();
    putStaticData(ns, { resetInfo });
    const ttc = getGoals(ns).timeToComplete();
    const currentWork = ns.singularity.getCurrentWork();
    const isGrafting = currentWork?.type === 'GRAFTING';
    const numberFormat = (n: number) => (isNaN(n) ? 'NaN' : ns.format.number(n));

    const install = getInstallUtility();
    const targets = getGraftTargets(ns, resetInfo.ownedAugs, entropy);
    const graftCandidates = targets
      .filter((target) => target.augmentation.name !== mostRecentGraft)
      .filter((target) => target.graftPrice <= money)
      .filter((target) => target.graftTime / 1000 < ttc)
      .filter((target) => install != null && target.utility > install.utility);
    const needsBladeburnerFocus =
      [6, 7].includes(resetInfo.currentNode) && !resetInfo.ownedAugs.has("The Blade's Simulacrum");

    if (graftCandidates.length > 0) {
      const { augmentation } = graftCandidates[0];
      if (pendingAug !== augmentation.name) {
        pendingAug = augmentation.name;
        cooldownStart = Date.now();
      }
    } else {
      pendingAug = '';
    }

    if (
      !isGrafting &&
      graftCandidates.length > 0 &&
      !needsBladeburnerFocus &&
      !closeToObjective()
    ) {
      const { augmentation, graftTime, graftPrice } = graftCandidates[0];
      putMoneyData(ns, { graftPriceReserve: graftPrice });
      const hasMetCooldown = Date.now() - cooldownStart >= PURCHASE_WAITING_PERIOD;
      if (hasMetCooldown) {
        if (city === 'New Tokyo' || ns.singularity.travelToCity('New Tokyo')) {
          if (ns.grafting.graftAugmentation(augmentation.name, ns.singularity.isFocused())) {
            mostRecentGraft = augmentation.name;
            pendingAug = '';
            putPlayerData(ns, { graftCompletionTime: Date.now() + graftTime });
            putMoneyData(ns, { graftPriceReserve: 0 });
          }
        }
      }
    } else {
      putMoneyData(ns, { graftPriceReserve: 0 });
    }

    const entropyCost = getEntropyCost(resetInfo);
    const columns = ['AUGMENTATION', 'FACTIONS', 'VALUE', 'NET', 'UTILITY', 'PRICE', 'TIME'];
    const rows = targets.map(
      ({ augmentation, value, netValue, utility, graftPrice, graftTime }) => {
        const canAfford = graftPrice <= money;
        const isCurrent =
          currentWork?.type === 'GRAFTING' && currentWork.augmentation === augmentation.name;
        const isPending = augmentation.name === pendingAug;
        const graftS = Math.ceil(graftTime / 1000);
        const hasTime = graftS <= ttc;
        const isEfficient = install != null && install.utility < utility;
        const trunc = (name: string) => (name.length <= 33 ? name : name.slice(0, 30) + '...');
        const nFormat = isCurrent ? C(34) : isPending ? INFO : (s: string) => s;
        const mFormat = canAfford ? nFormat : C(52);
        const tFormat = hasTime ? nFormat : C(52);
        const uFormat = isEfficient ? nFormat : C(52);
        const vFormat = netValue > 0 ? nFormat : C(52);
        return [
          nFormat(trunc(augmentation.name)),
          nFormat(augmentation.factions.length + ''),
          nFormat(numberFormat(value)),
          vFormat(numberFormat(netValue)),
          uFormat(numberFormat(utility)),
          mFormat('$' + numberFormat(graftPrice)),
          tFormat(formatTime(graftS)),
        ];
      },
    );
    ns.print('\n');
    ns.print(BRIGHT.BOLD(' PLAYER') + '');
    ns.print(' Utility     ' + numberFormat(getPlayerUtility(resetInfo, ns.getPlayer().mults)));
    ns.print(' Entropy     ' + `${entropy} (${numberFormat(0.98 ** entropy)})`);
    ns.print(' Cost/graft  ' + numberFormat(entropyCost));
    ns.print('\n');
    ns.print(BRIGHT.BOLD(' INSTALL') + '');
    ns.print(' Reference Value    ' + (install && numberFormat(install.value)));
    ns.print(' Reference Utility  ' + (install && numberFormat(install.utility)));
    ns.print('\n' + table(ns, columns, rows, { colors: true }) + '\n ');
    await ns.sleep(200);
  }
}
