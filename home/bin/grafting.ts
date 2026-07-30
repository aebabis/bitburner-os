import { BRIGHT, C } from '../lib/colors';
import { getGoals } from '../lib/goals/goals';
import { table } from '../lib/table';
import { formatTime } from '../lib/util';
import { getGraftTargets } from '../lib/grafting';
import { getStaticData } from '../lib/data-store';
import { getAugEvaluator, getEntropyCost, getPlayerUtility } from '../lib/aug-weights';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  const WIDTH = 955;
  const HEIGHT = 500;
  const winHeight = globalThis.innerHeight;
  ns.ui.resizeTail(WIDTH, HEIGHT);
  ns.ui.moveTail(249, winHeight - HEIGHT - 50);

  const { augmentationStats } = getStaticData(ns);

  const getInstallUtility = () => {
    const resetInfo = ns.getResetInfo();
    const scoreAug = getAugEvaluator(resetInfo, augmentationStats);
    const goals = getGoals(ns);
    const ttc = goals.timeToComplete();
    if (scoreAug == null || ttc == null) return null;

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

  while (true) {
    ns.clearLog();
    const { money, city, entropy } = ns.getPlayer();
    const resetInfo = ns.getResetInfo();
    const ttc = getGoals(ns).timeToComplete();
    const currentWork = ns.singularity.getCurrentWork();
    const isGrafting = currentWork?.type === 'GRAFTING';
    const numberFormat = (n: number) => (isNaN(n) ? 'NaN' : ns.format.number(n));

    const targets = getGraftTargets(ns, resetInfo.ownedAugs, entropy);
    const graftables = targets
      .filter((target) => target.graftPrice <= money)
      .filter((target) => ttc == null || target.graftTime / 1000 < ttc);
    const install = getInstallUtility();
    const needsBladeburnerFocus =
      [6, 7].includes(resetInfo.currentNode) && !resetInfo.ownedAugs.has("The Blade's Simulacrum");

    if (!isGrafting && graftables.length > 0 && !needsBladeburnerFocus) {
      const { augmentation, utility } = graftables[0];
      if (install != null && utility > install.utility) {
        if (city === 'New Tokyo' || ns.singularity.travelToCity('New Tokyo')) {
          ns.grafting.graftAugmentation(augmentation.name, ns.singularity.isFocused());
        }
      }
    }

    const entropyCost = getEntropyCost(resetInfo);
    const columns = ['AUGMENTATION', 'FACTIONS', 'VALUE', 'NET', 'UTILITY', 'PRICE', 'TIME'];
    const rows = targets.map(
      ({ augmentation, value, netValue, utility, graftPrice, graftTime }) => {
        const canAfford = graftPrice <= money;
        const isCurrent =
          currentWork?.type === 'GRAFTING' && currentWork.augmentation === augmentation.name;
        const graftS = Math.ceil(graftTime / 1000);
        const hasTime = ttc == null || graftS <= ttc;
        const isEfficient = install == null || install.utility < utility;
        const nFormat = isCurrent ? C(34) : (s: string) => s;
        const mFormat = canAfford ? nFormat : C(52);
        const tFormat = hasTime ? nFormat : C(52);
        const uFormat = isEfficient ? nFormat : C(52);
        const vFormat = netValue > 0 ? nFormat : C(52);
        return [
          nFormat(augmentation.name),
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
