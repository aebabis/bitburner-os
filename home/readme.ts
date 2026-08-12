import { Alias, ALIASES, CORE_ALIASES, SHORTHAND_ALIASES, UTILITY_ALIASES } from './etc/aliases';
import { KEYWORD, NORMAL, WARN } from './lib/colors';
import { sendTerminalCommand } from './lib/nav';
import { table } from './lib/table';

const getLines = (commands: Record<string, Alias>) => {
  const lines = [];
  for (const [name, alias] of Object.entries(commands))
    lines.push(KEYWORD.BOLD + name, NORMAL + '  ' + alias.desc);
  return lines;
};

const getHelp = (ns: NS) => {
  const column1 = getLines(UTILITY_ALIASES);
  const column2 = [...getLines(CORE_ALIASES), ' ', ...getLines(SHORTHAND_ALIASES)];
  const iters = Math.max(column1.length, column2.length);
  const rows = [];
  for (let i = 0; i < iters; i++) rows.push([column1[i] || '', column2[i] || '']);
  return table(ns, ['', ''], rows);
};

const getAliases = () =>
  Object.entries(ALIASES)
    .map(([name, alias]) => `alias ${name}=${JSON.stringify(alias.command)}`)
    .join(';');

export async function main(ns: NS) {
  const [command] = ns.args;
  if (command == null) {
    ns.tprint('\n' + getHelp(ns) + '\n\n');
  } else if (command === 'alias') {
    if ('alias' in ns.ui && typeof ns.ui.alias === 'function') {
      for (const [name, alias] of Object.entries(ALIASES)) {
        ns.tprint(WARN + 'ns.ui.alias has dropped. Remove deprecated code');
        ns.ui.alias(name, alias.command);
      }
    } else {
      await sendTerminalCommand(ns)(getAliases());
      ns.tprint(KEYWORD.BOLD + 'Aliases loaded');
    }
  }
}
