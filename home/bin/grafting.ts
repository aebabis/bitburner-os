import { C } from '../lib/colors';
import { getGoals } from '../lib/goals/goals';
import { table } from '../lib/table';
import { formatTime } from '../lib/util';
import { getGraftTargets } from '../lib/grafting';
import { makeAfkTracker } from '../lib/afk';

const shouldGraft = (ns: NS) => ns.sleeve.getSleeve(0).sync >= 100;

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  const columns = ['AUGMENTATION', 'FACTIONS', 'UTILITY', 'PRICE', 'TIME'];

  const afkTracker = makeAfkTracker(ns);
  const focus = () => afkTracker.timeSinceAction() > 20000;

  while (true) {
    ns.clearLog();
    const { money, city } = ns.getPlayer();
    const ttc = getGoals(ns).timeToComplete();
    const currentWork = ns.singularity.getCurrentWork();
    const graftables = getGraftTargets(ns, ns.getResetInfo().ownedAugs)
      .filter((target) => target.graftPrice <= money)
      .filter((target) => ttc == null || target.graftTime / 1000 < ttc);
    if (currentWork?.type !== 'GRAFTING' && shouldGraft(ns) && graftables.length > 0) {
      if (city === 'New Tokyo' || ns.singularity.travelToCity('New Tokyo')) {
        ns.grafting.graftAugmentation(graftables[0].augmentation.name, focus());
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
    ns.print('\n' + table(ns, columns, rows, { colors: true }));
    await ns.sleep(50);
  }
}
