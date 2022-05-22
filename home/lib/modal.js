const doc = eval('document');

let style = doc.querySelector('#custom-style');
if (style == null) {
    const style = doc.createElement('style');
    style.id = 'custom-style';
    style.innerText = `.windower p {
        line-height: 1.18;
        font-family: monospace;
    }
    
    [style~="none;"] + .windower { display: none; }`;
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
    const top = titlebar.parentElement;
    const buttons = titlebar.nextSibling;
    const bottom = top.nextSibling;
    const closeButton = buttons.children[2];
    const close = () => closeButton.click();
    if (!titlebar.getAttribute('flagged')) {
        titlebar.setAttribute('flagged', true);
        ns.atExit(close);
    }
    return {
        top,
        bottom,
        buttons,
        close,
    };
}

const charWidth = 9.65;
/** @param {NS} ns **/
export async function getModalColumnCount(ns) {
    const tailPane = await getTailModal(ns, true);
    if (tailPane == null)
        return null;
    tailPane.bottom.classList.add('windower');
    ns.clearLog();
    return Math.floor((tailPane.bottom.parentElement.clientWidth-2) / charWidth);
}
