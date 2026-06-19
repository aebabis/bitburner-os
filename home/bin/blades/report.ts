import { BRIGHT, C, MEDIUM, NORMAL } from '../../lib/colors';
import { table } from '../../lib/table';
import { by, formatTime } from '../../lib/util';
import { BladeCities, BladeCurrentAction, BladeSkills } from './burners.rip';

export const openTail = (ns: NS) => {
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.ui.resizeTail(355, 440);
};

const contentWidth = (ns: NS) =>
  Math.max(...ns.bladeburner.getOperationNames().map((name) => name.length)) + 11;

export const showInfo =
  (ns: NS) =>
  (
    cities: BladeCities,
    skills: BladeSkills,
    hasBlade: boolean,
    currentAction: BladeCurrentAction | null,
    currentCity: CityName,
    currentBlackOp: BladeburnerBlackOpName | null,
  ) => {
    ns.clearLog();

    ns.print(' ');
    ns.print(BRIGHT.BOLD + '  OPERATIONS');

    const blackOps = ns.bladeburner.getBlackOpNames();
    const completedBlackOps = blackOps.slice(
      0,
      currentBlackOp != null ? blackOps.indexOf(currentBlackOp) : blackOps.length,
    );
    for (const completedOp of completedBlackOps) {
      ns.print('  ' + completedOp.padEnd(contentWidth(ns) - 3) + C(10)('  ✓'));
    }
    if (currentBlackOp) {
      ns.print('  ' + MEDIUM(currentBlackOp));
    }

    ns.print(' ');

    ns.print(
      BRIGHT.BOLD +
        '  SIMULACRUM: ' +
        NORMAL(hasBlade ? 'Yes' : 'No ') +
        MEDIUM +
        ' '.repeat(21) +
        '▲',
    );
    ns.print('\n');
    const tFormat = (ms: number) => formatTime(ms).replace(/^0/, '');
    const columns = [' ACTION', ''];
    const rows = !currentAction
      ? [[' (none)', '']]
      : [
          [
            ' ' + currentAction.name,
            `${tFormat(currentAction.time / 1000)}/${tFormat(currentAction.duration / 1000)}`,
          ],
        ];
    ns.print(table(ns, columns, rows, { colors: true }));
    if (cities) {
      ns.print('\n');
      const columns = [
        ' CITY',
        { name: '     EST POP', align: 'right' },
        { name: ' CMTY', align: 'right' },
        { name: ' CHAOS', align: 'right' },
      ];
      const rows = Object.entries(cities)
        .sort(by(([, stats]) => -stats.estimatedPopulation))
        .map(([city, stats]) => [
          ' ' + city + (city === currentCity ? '*' : ''),
          ns.format.number(stats.estimatedPopulation).padStart(8),
          stats.communities,
          ns.format.number(stats.chaos).replace(/^0/, ' '),
        ]);
      ns.print(table(ns, columns, rows, { colors: true }));
    }
    if (skills) {
      ns.print('\n');
      const format = (upgraded: boolean) => (upgraded ? C(40) : NORMAL);

      const columns = [
        ' SKILL',
        { name: '       COST', align: 'right' },
        { name: ' LEVEL', align: 'right' },
      ];
      const rows = skills
        .filter(({ limit }) => limit > 0)
        .sort((a, b) => (a.limit > b.limit ? 1 : -1))
        .map(({ name, cost, level, limit, upgradedThisTick }) => [
          ' ' + format(upgradedThisTick)(name),
          format(upgradedThisTick)(ns.format.number(cost, 0)),
          format(upgradedThisTick)(level + '/' + ns.format.number(limit, 0)),
        ]);
      ns.print(table(ns, columns, rows, { colors: true }));
    }
    ns.print('\n');
  };
