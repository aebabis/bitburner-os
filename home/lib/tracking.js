/** @param {NS} ns */
export const afkTracker = (ns, DELAY = 10000) => {
    let timer, isAfk;
    const win = eval('window');
    const start = () => timer = setTimeout(() => isAfk = true, DELAY);
    const reset = () => {
        isAfk = false;
        clearTimeout(timer);
        start();
    }
    win.addEventListener('mousemove', reset);
    win.addEventListener('keypress', reset);
    win.addEventListener('click', reset);
    ns.atExit(() => {
        win.removeEventListener('mousemove', reset);
        win.removeEventListener('keypress', reset);
        win.removeEventListener('click', reset);
    })
    start();
    return () => isAfk;
}

/** @param {NS} ns */
export const terminalTracker = (ns) => {
    const doc = eval('document');
    let inTerminal;

    const update = () => doc.activeElement != null &&
        doc.activeElement === doc.querySelector('#terminal-input');
    
    doc.body.addEventListener('focus', update);
    doc.body.addEventListener('blur', update);
    
    ns.atExit(() => {
        doc.body.removeEventListener('focus', update);
        doc.body.removeEventListener('blur', update);
    });

    update();

    return () => inTerminal;
}