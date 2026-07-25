import { C } from '../lib/colors';
import { getGoals } from '../lib/goals/goals';
import { table } from '../lib/table';
import { formatTime } from '../lib/util';
import { getGraftTargets } from '../lib/grafting';
import { getStaticData } from '../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  const columns = ['AUGMENTATION', 'FACTIONS', 'UTILITY', 'PRICE', 'TIME'];

  const { augmentationGraftPrices } = getStaticData(ns);

  const sleeveReady = () => ns.sleeve.getSleeve(0).sync >= 100;

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
    if (currentWork?.type !== 'GRAFTING' && shouldGraft(ns) && graftables.length > 0) {
      const target = graftables[0];
      if (
        target.augmentation.name === VIOLET ||
        ownedAugs.has(VIOLET) ||
        target.utility > 2 ||
        sleeveReady()
      ) {
        if (city === 'New Tokyo' || ns.singularity.travelToCity('New Tokyo')) {
          ns.grafting.graftAugmentation(
            graftables[0].augmentation.name,
            ns.singularity.isFocused(),
          );
        }
      }
    }
    const rows = getGraftTargets(ns, ns.getResetInfo().ownedAugs).map(
      ({ augmentation, utility, graftPrice, graftTime }) => {
        const canAfford = graftPrice <= money;
        const isGrafting =
          currentWork?.type === 'GRAFTING' && currentWork.augmentation === augmentation.name;
        const graftS = Math.ceil(graftTime / 1000);
        const hasTime = ttc == null || graftS <= ttc;
        const nFormat = isGrafting ? C(34) : (s: string) => s;
        const mFormat = canAfford ? nFormat : C(52);
        const tFormat = hasTime ? nFormat : C(52);
        return [
          nFormat(augmentation.name),
          nFormat(augmentation.factions.length + ''),
          nFormat(ns.format.number(utility)),
          mFormat('$' + ns.format.number(graftPrice)),
          tFormat(formatTime(graftS)),
        ];
      },
    );
    ns.print('\n' + table(ns, columns, rows, { colors: true }) + '\n ');
    await ns.sleep(50);
  }
}
