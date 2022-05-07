const doc = eval('document');

let style = doc.querySelector('#custom-style');
if (style == null) {
    const style = doc.createElement('style');
    style.id = 'custom-style';
    style.innerText = `.react-resizable .windower p {
        line-height: 1.18;
        font-family: monospace;
    }`;
    doc.head.append(style);
}

/** @param {NS} ns **/
export function getCommandLine(ns) {
    return ns.getScriptName() + ' ' + ns.args.join(' ');
}

/** @param {NS} ns **/
export async function getTailModal(ns, retry=true) {
    if (retry)
        ns.tail();
    const commandLine = getCommandLine(ns);
    let titlebar;
    while (true) {
        titlebar = doc.querySelector(`.drag > h6[title="${commandLine}"]`);
        if (titlebar != null)
            break;
        if (retry) await ns.sleep(50);
        else return null;
    }
    const modal = titlebar.parentElement.parentElement.nextSibling;
    const close = titlebar.nextSibling.children[2];
    if (!titlebar.getAttribute('flagged')) {
        titlebar.setAttribute('flagged', true);
        ns.atExit(() => close.click());
    }
    return modal;
}

let charWidth;
/** @param {NS} ns **/
export async function getModalColumnCount(ns) {
    const elem = await getTailModal(ns, true);
    if (elem == null)
        return null;
    const container = elem.querySelector('.MuiBox-root');
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