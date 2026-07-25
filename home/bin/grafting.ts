import { BRIGHT, C } from '../lib/colors';
import { getGoals } from '../lib/goals/goals';
import { table } from '../lib/table';
import { formatTime } from '../lib/util';
import { getGraftTargets } from '../lib/grafting';
import { getStaticData } from '../lib/data-store';
import { getAugEvaluator } from '../lib/aug-weights';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();

  const { augmentationGraftPrices, augmentationStats } = getStaticData(ns);

  const sleeveReady = () => ns.sleeve.getSleeve(0).sync >= 100;

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
      utility: (1e6 * value) / ttc,
    };
  };

  const VIOLET = 'violet Congruity Implant';
  const shouldGraft = (ns: NS) => {
    return (
      sleeveReady() ||
      ns.getResetInfo().ownedAugs.has(VIOLET) ||
      ns.getPlayer().money >= augmentationGraftPrices[VIOLET]
    );
  };

  while (true) {
    ns.clearLog();
    const { money, city } = ns.getPlayer();
    const { ownedAugs } = ns.getResetInfo();
    const ttc = getGoals(ns).timeToComplete();
    const currentWork = ns.singularity.getCurrentWork();
    const graftables = getGraftTargets(ns, ownedAugs)
      .filter((target) => target.graftPrice <= money)
      .filter((target) => ttc == null || target.graftTime / 1000 < ttc);
    const install = getInstallUtility();
    if (currentWork?.type !== 'GRAFTING' && shouldGraft(ns) && graftables.length > 0) {
      const target = graftables[0];
      const isGraftEfficient = install != null && target.utility > install.utility;
      if (
        isGraftEfficient ||
        target.augmentation.name === VIOLET ||
        (ownedAugs.has(VIOLET) && sleeveReady())
      ) {
        if (city === 'New Tokyo' || ns.singularity.travelToCity('New Tokyo')) {
          ns.grafting.graftAugmentation(
            graftables[0].augmentation.name,
            ns.singularity.isFocused(),
          );
        }
      }
    }
    const columns = ['AUGMENTATION', 'FACTIONS', 'VALUE', 'UTILITY', 'PRICE', 'TIME'];
    const rows = getGraftTargets(ns, ns.getResetInfo().ownedAugs).map(
      ({ augmentation, value, utility, graftPrice, graftTime }) => {
        const canAfford = graftPrice <= money;
        const isGrafting =
          currentWork?.type === 'GRAFTING' && currentWork.augmentation === augmentation.name;
        const graftS = Math.ceil(graftTime / 1000);
        const hasTime = ttc == null || graftS <= ttc;
        const isEfficient = install == null || install.utility < utility;
        const nFormat = isGrafting ? C(34) : (s: string) => s;
        const mFormat = canAfford ? nFormat : C(52);
        const tFormat = hasTime ? nFormat : C(52);
        const uFormat = isEfficient ? nFormat : C(52);
        return [
          nFormat(augmentation.name),
          nFormat(augmentation.factions.length + ''),
          nFormat(ns.format.number(value)),
          uFormat(ns.format.number(utility)),
          mFormat('$' + ns.format.number(graftPrice)),
          tFormat(formatTime(graftS)),
        ];
      },
    );
    ns.print(BRIGHT.BOLD(' INSTALL') + '');
    ns.print(BRIGHT(' Reference Value:   ') + (install && ns.format.number(install.value)));
    ns.print(BRIGHT(' Reference Utility: ') + (install && ns.format.number(install.utility)));
    ns.print('\n' + table(ns, columns, rows, { colors: true }) + '\n ');
    await ns.sleep(200);
  }
}
