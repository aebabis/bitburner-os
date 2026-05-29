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

function getCommandLine(ns: NS) {
  return ns.getScriptName() + ' ' + ns.args.join(' ');
}

export async function getTailModal(ns: NS, retry = true) {
  if (retry) ns.ui.openTail();
  const commandLine = getCommandLine(ns);
  let titlebar;
  while (true) {
    titlebar = doc.querySelector(`.drag > h6[title="${commandLine}"]`);
    if (titlebar != null) break;
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

const charWidth = (ns: NS) => (9.65 * ns.ui.getStyles().tailFontSize) / 16;

export async function getModalColumnCount(ns: NS) {
  const tailPane = await getTailModal(ns, true);
  if (tailPane == null) return null;
  tailPane.bottom.classList.add('windower');
  ns.clearLog();
  return Math.floor(
    (tailPane.bottom.parentElement.clientWidth - 2) / charWidth(ns),
  );
}
