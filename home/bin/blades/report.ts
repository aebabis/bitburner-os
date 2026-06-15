import { BRIGHT, C, MEDIUM, NORMAL } from '../../lib/colors';
import { BladeCurrentAction, getBladeData } from '../../lib/data-store';
import { table } from '../../lib/table';
import { by, formatTime } from '../../lib/util';

const hasBlade = (ns: NS) => ns.getResetInfo().ownedAugs.has("The Blade's Simulacrum");

const getActionDuration = (ns: NS, action: BladeCurrentAction) => {
  const { actions } = getBladeData(ns);
  switch (action.type) {
    case 'General':
      return actions.General[action.name].duration;
    case 'Contracts':
      return actions.Contracts[action.name].duration;
    case 'Operations':
      return actions.Operations[action.name].duration;
    case 'Black Operations':
      return actions['Black Operations'][action.name].duration;
  }
};

const showInfo = (ns: NS) => {
  ns.clearLog();

  const { cities, skills, currentAction } = getBladeData(ns);
  ns.print(
    BRIGHT.BOLD +
      '  SIMULACRUM: ' +
      NORMAL(hasBlade(ns) ? 'Yes' : 'No ') +
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
          `${tFormat(currentAction.time / 1000)}/${tFormat(getActionDuration(ns, currentAction) / 1000)}`,
        ],
      ];
  ns.print(table(ns, columns, rows, { colors: true }));
  if (cities) {
    ns.print('\n');
    const columns = [
      ' CITY',
      { name: '     EST POP', align: 'right' },
      { name: 'CMTY', align: 'right' },
      { name: ' CHAOS', align: 'right' },
    ];
    const rows = Object.entries(cities)
      .sort(by(([, stats]) => -stats.estimatedPopulation))
      .map(([city, stats]) => [
        ' ' + city,
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
      { name: '      COST', align: 'right' },
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

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.ui.resizeTail(350, 440);

  while (true) {
    showInfo(ns);
    await ns.bladeburner.nextUpdate();
  }
}
