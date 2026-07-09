import { putPlayerData } from '../lib/data-store';

const doc = eval('document');

const MAIN_FUNCTION_ERROR = 'cannot be run because it does not have a main function.';
const DYNAMIC_LOAD_ERROR = 'loading dynamically imported module';
const ERRORS = [MAIN_FUNCTION_ERROR, DYNAMIC_LOAD_ERROR];

const autoClosePopUps = (ns: NS) => {
  let timer = 0;
  let timeout = 1;
  const check = () => {
    const popup = doc.querySelector('.MuiModal-root');
    if (popup != null && ERRORS.some((error) => popup.innerText.includes(error))) {
      popup.children[0].click();
      timeout = 1;
    } else {
      timeout = Math.min(1000, timeout * 2);
    }
    timer = +setTimeout(check, timeout);
  };

  const stop = () => clearTimeout(timer);
  ns.atExit(stop);

  check();

  return stop;
};

export async function main(ns: NS) {
  autoClosePopUps(ns);

  let wasPlayerUsingTerminal;
  let isPlayerUsingTerminal;

  while (true) {
    if (isPlayerUsingTerminal !== wasPlayerUsingTerminal)
      putPlayerData(ns, { isPlayerUsingTerminal });
    wasPlayerUsingTerminal = isPlayerUsingTerminal;
    await ns.sleep(50);
  }
}
