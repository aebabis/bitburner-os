const doc = eval('document');
const win = eval('window');

/** @param {NS} ns */
export const afkTracker = (ns) => {
    let time = Date.now();
    const track = () => time = Date.now();
    win.addEventListener('mousemove', track, true);
    win.addEventListener('keypress', track, true);
    win.addEventListener('click', track, true);
    ns.atExit(() => {
        win.removeEventListener('mousemove', track, true);
        win.removeEventListener('keypress', track, true);
        win.removeEventListener('click', track, true);
    });
    return () => Date.now() - time;
};

/** @param {NS} ns */
export const terminalTracker = (ns) => {
    let lastKeypress = Date.now();

    const update = () => lastKeypress = Date.now();
    
    doc.body.addEventListener('keypress', update, true);
    
    ns.atExit(() => {
        doc.body.removeEventListener('keypress', update, true);
    });

    return () => doc.activeElement != null &&
        doc.activeElement.matches('#terminal-input') &&
        Date.now() - lastKeypress < 10000;
};

const MAIN_FUNCTION_ERROR = 'cannot be run because it does not have a main function.';
const DYNAMIC_LOAD_ERROR = 'loading dynamically imported module';
const ERRORS = [MAIN_FUNCTION_ERROR, DYNAMIC_LOAD_ERROR];

/** @param {NS} ns */
export const autoClosePopUps = (ns) => {
    let timer;
    let timeout = 1;
    const check = () => {
        const popup = doc.querySelector('.MuiModal-root');
        if (popup != null && ERRORS.some(error=>popup.innerText.includes(error))) {
            popup.children[0].click();
            timeout = 1;
        } else {
            timeout = Math.min(1000, timeout * 2);
        }
        timer = setTimeout(check, timeout);
    };

    const stop = () => clearTimeout(timer);
    ns.atExit(stop);

    check();

    return stop;
};