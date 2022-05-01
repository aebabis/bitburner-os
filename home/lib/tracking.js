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
    win.addEventListener('mousemove', reset, true);
    win.addEventListener('keypress', reset, true);
    win.addEventListener('click', reset, true);
    ns.atExit(() => {
        win.removeEventListener('mousemove', reset, true);
        win.removeEventListener('keypress', reset, true);
        win.removeEventListener('click', reset, true);
        clearTimeout(timer);
    })
    start();
    return () => isAfk;
}

/** @param {NS} ns */
export const terminalTracker = (ns) => {
    let lastKeypress = Date.now();

    const update = () => lastKeypress = Date.now();
    
    doc.body.addEventListener('keypress', update, true);
    
    ns.atExit(() => {
        doc.body.removeEventListener('keypress', update, true);
    });

    return () => doc.activeElement != null &&
        doc.activeElement === doc.querySelector('#terminal-input') &&
        Date.now() - lastKeypress < 10000;
}

const MAIN_FUNCTION_ERROR = 'cannot be run because it does not have a main function.'

/** @param {NS} ns */
export const autoClosePopUps = (ns) => {
    let timer;
    const check = () => {
        const popup = doc.querySelector('.MuiBackdrop-root');
        if (popup == null || popup.innerText.includes(MAIN_FUNCTION_ERROR)) {
            timer = setTimeout(check, 1000);
        } else {
            console.log(popup.innerText);
            popup.click();
            timer = setTimeout(check, 1);
        }
    };

    const stop = () => clearTimeout(timer);
    ns.atExit(stop);

    check();

    return stop;
}