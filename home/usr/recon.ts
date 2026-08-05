const BN_DATA = 'etc/bn-data.json';
const NUM_BN = 15;

const getData = (ns: NS) => {
  const content = ns.read(BN_DATA);
  if (content === '') return [];
  else return JSON.parse(content);
};

const BNs = new Array(NUM_BN).fill(0).map((_, i) => i + 1);

const getNextBN = (ns: NS, currentNode: number) => {
  const data = getData(ns);
  const testOrder = BNs.slice(currentNode).concat(BNs.slice(0, currentNode));
  return testOrder.find((bn) => data[bn] == null);
};

const WARNING =
  'This program must leave the current bitnode to gather data. ' +
  'Are you sure you want to do this?';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const { currentNode, lastNodeReset } = ns.getResetInfo();
  const timeSinceReset = Date.now() - lastNodeReset;
  if (timeSinceReset > 10000 && !(await ns.prompt(WARNING))) {
    return;
  }
  const { wipe } = ns.flags([['wipe', false]]);
  if (wipe) {
    ns.write(BN_DATA, '', 'w');
  } else {
    ns.stanek.acceptGift();
    const existingData = getData(ns);
    const bitNodeMultipliers = ns.getBitNodeMultipliers();
    const stanekData = {
      width: ns.stanek.giftWidth(),
      height: ns.stanek.giftHeight(),
    };
    existingData[currentNode] = { bitNodeMultipliers, stanekData };
    ns.write(BN_DATA, JSON.stringify(existingData), 'w');
  }
  const nextBN = getNextBN(ns, currentNode);
  if (nextBN) {
    ns.singularity.b1tflum3(nextBN, ns.getScriptName());
  } else {
    ns.ui.openTail();
    ns.print(JSON.stringify(getData(ns), null, 2));
  }
}
