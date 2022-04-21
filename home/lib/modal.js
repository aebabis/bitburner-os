const doc = eval('document');

export function getCommandLine(ns) {
    return ns.getScriptName() + ' ' + ns.args.join(' ');
}

export async function getTailModal(ns) {
    ns.tail();
    const commandLine = getCommandLine(ns);
    let titlebar;
    while (true) {
        titlebar = doc.querySelector(`.drag > h6[title="${commandLine}"]`);
        if (titlebar != null)
            return titlebar.parentElement.parentElement.nextSibling;
        else
            await ns.sleep(10);
    }
}