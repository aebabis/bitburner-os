import { defer } from './defer';
import { tprint } from './util';
import { STR, WARN } from '../lib/colors';
import { ALIASES } from '../etc/aliases';

export async function main(ns: NS) {
  ns.disableLog('ALL');

  // const FONT = 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap';
  // const doc = eval('document');
  // if (doc.querySelector(`[href="${FONT}"]`) == null) {
  //     const div = doc.createElement('div');
  //     div.innerHTML = `<link href="${FONT}" rel="stylesheet">`;
  //     doc.head.append(div.firstChild);
  // }

  tprint(ns)(STR.BOLD + 'APPLYING UI SETTINGS');

  tprint(ns)(STR + '  Setting Styles');
  const styles = ns.ui.getStyles();
  styles.lineHeight = 1.18;
  styles.fontFamily = `monospace`;
  ns.ui.setStyles(styles);

  if ('alias' in ns.ui && typeof ns.ui.alias === 'function') {
    tprint(ns)(STR.BOLD + '  Applying Aliases');
    for (const [name, alias] of Object.entries(ALIASES)) {
      tprint(ns)(WARN + 'ns.ui.alias has dropped. Remove if-statement');
      ns.ui.alias(name, alias.command);
    }
  }

  // Go to next step in the boot sequence
  await defer(ns)(...ns.args);
}
