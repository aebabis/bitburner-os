const doc = eval('document');

let style = doc.querySelector('#custom-style');
if (style == null) {
    const style = doc.createElement('style');
    style.id = 'custom-style';
    style.innerText = `.react-resizable .windower p {
        line-height: 1;
        font-family: monospace;
    }`;
    doc.head.append(style);
}

/** @param {NS} ns **/
export function getCommandLine(ns) {
    return ns.getScriptName() + ' ' + ns.args.join(' ');
}

let modal;
/** @param {NS} ns **/
export async function getTailModal(ns) {
    if (modal != null)
        return modal;
    ns.tail();
    const commandLine = getCommandLine(ns);
    let titlebar;
    while (true) {
        titlebar = doc.querySelector(`.drag > h6[title="${commandLine}"]`);
        if (titlebar != null)
            return modal = titlebar.parentElement.parentElement.nextSibling;
        else
            await ns.sleep(10);
    }
}

let charWidth;
/** @param {NS} ns **/
export async function getModalColumnCount(ns) {
    const elem = await getTailModal(ns);
    const container = elem.querySelector('.MuiBox-root');
    if (container.offsetParent == null)
      ns.exit();
    container.classList.add('windower');
    if (charWidth == null) {
        const testString = '0'.repeat(48);
        ns.print(testString);
        let testP;
        while (testP == null) {
            testP = container.querySelector('p');
            await ns.sleep(10);
        }
        testP.style.display = 'inline';
        const { width } = testP.getBoundingClientRect();
        charWidth = width / testString.length;
    }
    ns.clearLog();
    return Math.floor((container.clientWidth-2) / charWidth);
}