const doc = eval('document');
const win = eval('window');

/** @param {NS} ns */
export const afkTracker = (ns, DELAY = 10000) => {
    let timer, isAfk;
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
        clearTimeout(timer);
    })
    start();
    return () => isAfk;
}

/** @param {NS} ns */
export const terminalTracker = (ns) => {
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

const MAIN_FUNCTION_ERROR = 'cannot be run because it does not have a main function.'

/** @param {NS} ns */
export const autoClosePopUps = (ns) => {
    let timer;
    const check = () => {
        const popup = doc.querySelector('.MuiBackdrop-root');
        if (popup != null && popup.innerText.includes(MAIN_FUNCTION_ERROR)) {
            popup.click();
            timer = setTimeout(check, 1);
        } else {
            timer = setTimeout(check, 1000);
        }
    };

    const stop = () => clearTimeout(timer);
    ns.atExit(stop);

    check();

    return stop;
}