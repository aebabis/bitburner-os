import { defer } from './boot/defer';
import { C_MAIN, tprint } from './boot/util';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    // const FONT = 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap';
    // const doc = eval('document');
    // if (doc.querySelector(`[href="${FONT}"]`) == null) {
    //     const div = doc.createElement('div');
    //     div.innerHTML = `<link href="${FONT}" rel="stylesheet">`;
    //     doc.head.append(div.firstChild);
    // }

    tprint(ns)(C_MAIN + 'SETTING STYLES');
    const styles = ns.ui.getStyles();
    styles.lineHeight = 1.18;
    styles.fontFamily = `monospace`;
    ns.ui.setStyles(styles);

    // Go to next step in the boot sequence
	await defer(ns)(...ns.args);
}