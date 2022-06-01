import { putPlayerData } from './lib/data-store';
import { hasSingularityApi } from './lib/query-service';

const doc = eval('document');
const win = eval('window');

const ACTIVITY_TIMEOUT = 20000;

const MAIN_FUNCTION_ERROR = 'cannot be run because it does not have a main function.';
const DYNAMIC_LOAD_ERROR = 'loading dynamically imported module';
const ERRORS = [MAIN_FUNCTION_ERROR, DYNAMIC_LOAD_ERROR];

/** @param {NS} ns */
const autoClosePopUps = (ns) => {
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


/** @param {NS} ns */
const afkTracker = (ns) => {
    let lastActivity = Date.now();
    const track = () => lastActivity = Date.now();
    win.addEventListener('mousemove', track, true);
    win.addEventListener('keypress', track, true);
    win.addEventListener('click', track, true);
    ns.atExit(() => {
        win.removeEventListener('mousemove', track, true);
        win.removeEventListener('keypress', track, true);
        win.removeEventListener('click', track, true);
    });
    return () => lastActivity;
};

/** @param {NS} ns */
const terminalTracker = (ns) => {
    let lastTerminalActivity = Date.now();

    const update = (event) => {
        if (event.target.id === 'terminal-input')
            lastTerminalActivity = Date.now()
    };
    
    doc.body.addEventListener('keypress', update, true);
    
    ns.atExit(() => {
        doc.body.removeEventListener('keypress', update, true);
    });

    return () => lastTerminalActivity;
};

const createIndicator = (ns) => {
    const indicator = doc.createElement('div');
    indicator.innerText = '●';
    indicator.style.position = 'fixed';
    indicator.style.right = 0;
    indicator.style.bottom = 0;
    indicator.style.fontSize = '10px';
    indicator.style.padding = '.5em';
    doc.body.append(indicator);
    ns.atExit(() => indicator.remove());
    return indicator;
}

/** @param {NS} ns **/
export async function main(ns) {
    const hasSingularity = hasSingularityApi(ns);

    autoClosePopUps(ns);

    const indicator = createIndicator(ns);
    const getLastPlayerActivity = afkTracker(ns);
    const getLastTerminalActivity = terminalTracker(ns);

    let wasPlayerActive;
    let wasPlayerUsingTerminal;
    let isPlayerActive;
    let isPlayerUsingTerminal;

    while (true) {
        const timeSincePlayerActivity = Date.now() - getLastPlayerActivity();
        const timeSinceTerminalActivity = Date.now() - getLastTerminalActivity();

        if (timeSincePlayerActivity < 2000)
            indicator.style.color = 'green';
        else if (timeSincePlayerActivity < ACTIVITY_TIMEOUT)
            indicator.style.color = 'yellow';
        else
            indicator.style.color = 'red';

        isPlayerActive = timeSincePlayerActivity < ACTIVITY_TIMEOUT;
        isPlayerUsingTerminal = timeSinceTerminalActivity < ACTIVITY_TIMEOUT;

        if (isPlayerActive !== wasPlayerActive || isPlayerUsingTerminal !== wasPlayerUsingTerminal)
            putPlayerData(ns, { isPlayerActive, isPlayerUsingTerminal });
        
        if (hasSingularity)
            ns.setFocus(!isPlayerActive);

        wasPlayerActive = isPlayerActive;
        wasPlayerUsingTerminal = isPlayerUsingTerminal;

        await ns.sleep(50);
    }
};