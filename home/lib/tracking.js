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
    })
    return () => Date.now() - time;
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
        doc.activeElement.matches('#terminal-input') &&
        Date.now() - lastKeypress < 10000;
}

const MAIN_FUNCTION_ERROR = 'cannot be run because it does not have a main function.'

/** @param {NS} ns */
export const autoClosePopUps = (ns) => {
    let timer;
    const check = () => {
        doc.querySelectorAll('.MuiModal-root').forEach((popup) => {
            if (popup.innerText.includes(MAIN_FUNCTION_ERROR))
                popup.children[0].click();
        })
        timer = setTimeout(check, 1000);
    };

    const stop = () => clearTimeout(timer);
    ns.atExit(stop);

    check();

    return stop;
}