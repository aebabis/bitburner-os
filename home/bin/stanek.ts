import { CHARGE } from '../etc/filenames';
import { getPlayerData, getStaticData, putPlayerData } from '../lib/data-store';
import { getRamAllowances, getWorkerRam } from '../lib/ram-router';

type FragmentPosition = [number, number, number, number];
type FragmentFocus = GymType | 'hack' | 'cha' | 'bb';

const HACK_5_5 = (): FragmentPosition[] => [
  [3, 0, 1, 101],
  [0, 0, 3, 6],
  [1, 0, 0, 1],
  [1, 1, 0, 7],
  [2, 3, 2, 5],
  [0, 3, 2, 0],
];
const HACK_6_5 = (): FragmentPosition[] => [
  [1, 3, 0, 0],
  [5, 0, 1, 6],
  [3, 3, 2, 5],
  [0, 2, 3, 1],
  [1, 1, 2, 103],
  [0, 0, 1, 7],
  [3, 0, 2, 21],
];
const S_6_5 = (activeId: number): FragmentPosition[] => [
  [2, 1, 2, activeId],
  [0, 0, 0, 101],
  [0, 1, 2, 105],
  [4, 0, 1, 101],
  [0, 3, 0, 102],
  [3, 2, 3, 106],
];
const T_6_5 = (activeId: number): FragmentPosition[] => [
  [2, 1, 0, activeId],
  [3, 2, 3, 106],
  [4, 0, 1, 101],
  [0, 0, 0, 101],
  [0, 1, 3, 103],
  [1, 2, 3, 107],
];
const L_6_5 = (activeId: number): FragmentPosition[] => [
  [2, 1, 2, activeId],
  [3, 2, 3, 106],
  [4, 0, 1, 101],
  [0, 0, 0, 101],
  [0, 1, 3, 103],
  [1, 2, 0, 105],
];
const HACK_6_6 = (): FragmentPosition[] => [
  [4, 1, 3, 0],
  [1, 1, 0, 104],
  [3, 2, 1, 105],
  [2, 4, 2, 1],
  [0, 4, 2, 5],
  [0, 1, 3, 6],
  [1, 0, 1, 25],
  [3, 0, 2, 7],
];
const GYM_6_6 = (): FragmentPosition[] => [
  [1, 1, 0, 10],
  [4, 0, 3, 12],
  [1, 2, 1, 14],
  [3, 3, 2, 16],
  [0, 0, 0, 101],
  [0, 2, 3, 101],
  [2, 4, 2, 101],
  [2, 1, 0, 105],
];
const HACK_7_6 = (): FragmentPosition[] => [
  [1, 1, 2, 100],
  [3, 2, 2, 105],
  [3, 0, 2, 0],
  [0, 0, 2, 6],
  [0, 1, 2, 21],
  [5, 0, 1, 5],
  [5, 3, 3, 7],
  [4, 3, 3, 1],
  [0, 5, 2, 20],
  [0, 3, 0, 25],
];
const S_7_6 = (activeId: number): FragmentPosition[] => [
  [2, 2, 2, activeId],
  [3, 0, 0, 101],
  [0, 0, 3, 105],
  [4, 1, 3, 105],
  [4, 3, 3, 105],
  [0, 1, 1, 102],
  [0, 4, 2, 102],
  [3, 4, 2, 5],
];
const C_8_7 = (activeId: number): FragmentPosition[] => [
  [0, 3, 3, 101],
  [0, 0, 0, 101],
  [4, 5, 2, 101],
  [3, 5, 2, 12],
  [1, 4, 0, 100],
  [1, 3, 2, 14],
  [0, 1, 2, 16],
  [2, 0, 0, 105],
  [4, 2, 3, 10],
  [5, 3, 3, 107],
  [6, 0, 1, 101],
  [5, 0, 1, activeId],
];
const HACK_8_7 = (): FragmentPosition[] => [
  [0, 3, 3, 101],
  [1, 5, 0, 1],
  [1, 4, 0, 103],
  [1, 2, 0, 0],
  [4, 5, 2, 101],
  [0, 0, 1, 25],
  [3, 3, 3, 105],
  [6, 3, 3, 5],
  [6, 0, 1, 101],
  [2, 0, 2, 6],
  [5, 1, 1, 7],
  [1, 1, 0, 101],
];
const CHA_8_7 = (): FragmentPosition[] => [
  [3, 2, 0, 18],
  [5, 3, 3, 101],
  [2, 4, 0, 105],
  [1, 4, 2, 105],
  [0, 3, 2, 105],
  [6, 2, 3, 101],
  [0, 2, 0, 101],
  [3, 0, 0, 102],
  [5, 0, 2, 106],
];

const getLayout = (focus: FragmentFocus, width: number, height: number) => {
  if (height > 7) {
    return getLayout(focus, 8, 7);
  } else if (width === 8 && height === 7) {
    if (focus === 'hack') return HACK_8_7();
    if (focus === 'bb') return C_8_7(30);
    if (focus === 'cha') return CHA_8_7();
    return C_8_7(18);
  } else if (width > 7 || height > 6) {
    return getLayout(focus, 7, 6);
  } else if (width === 7 && height === 6) {
    if (focus === 'hack') return HACK_7_6();
    if (focus === 'cha') return S_7_6(18);
    return getLayout(focus, 6, 6);
  } else if (width === 6 && height === 6) {
    if (focus === 'hack') return HACK_6_6();
    if (focus === 'bb') return S_6_5(30);
    else return GYM_6_6();
  } else if (width === 6 && height === 5) {
    if (focus === 'hack') return HACK_6_5();
    if (focus === 'bb') return S_6_5(30);
    if (focus === 'str') return T_6_5(10);
    if (focus === 'def') return L_6_5(12);
    if (focus === 'dex') return L_6_5(14);
    if (focus === 'agi') return S_6_5(16);
    if (focus === 'cha') return S_6_5(18);
  } else if (width === 5 && height === 5) {
    return HACK_5_5();
  }
  throw new Error(`Layout not found: ${focus} (${width}x${height})`);
};

const setupGift = (ns: NS, positions: FragmentPosition[]) => {
  ns.stanek.clearGift();
  for (const [x, y, rotation, id] of positions) {
    ns.stanek.placeFragment(x, y, rotation, id);
  }
};

const getFocus = (ns: NS, resetInfo: ResetInfo): FragmentFocus => {
  const { currentWork } = getPlayerData(ns);
  if ([6, 7].includes(resetInfo.currentNode) && ns.bladeburner.inBladeburner()) {
    return 'bb';
  }
  if (resetInfo.currentNode === 15) {
    return 'cha';
  }
  if (currentWork?.type === 'CLASS') {
    if (Object.values(ns.enums.GymType).includes(currentWork.classType as GymType)) {
      return currentWork.classType as GymType;
    }
  }
  return 'hack';
};

const areLayoutsSame = (layout1: FragmentPosition[], layout2: FragmentPosition[]) => {
  const set1 = new Set(layout1.map((position) => position.join(',')));
  const set2 = new Set(layout2.map((position) => position.join(',')));
  if (set1.size !== set2.size) return false;
  return [...set1].every((position) => set2.has(position));
};

const getFragmentMultipliers = (ns: NS) => {
  const multipliers = Object.values(ns.enums.FragmentType).reduce((arr, type) => {
    arr[type] = 1;
    return arr;
  }, [] as number[]);
  for (const { type, chargedEffect } of ns.stanek.activeFragments()) {
    multipliers[type] *= chargedEffect;
  }
  return multipliers as unknown as Record<FragmentType, number>;
};

export async function main(ns: NS) {
  try {
    ns.stanek.activeFragments();
  } catch {
    // Dodge RAM cost of acceptGift, as it only happens once.
    // Calling it here instead of bootloader allows service manager override.
    if (ns.stanek['acceptGift']()) {
      putPlayerData(ns, { hasGift: true });
    }
    return;
  }

  ns.disableLog('ALL');
  const { resetInfo, scriptRam } = getStaticData(ns);
  const RAM_PER_SHARE = scriptRam[CHARGE.replace(/^\//, '')];

  const chargeThreads = new Map<number, number>();

  let lastUpdate = 0;
  while (true) {
    ns.clearLog();
    const currentThreads = [...chargeThreads.entries()]
      .filter(([pid]) => ns.isRunning(pid))
      .map(([, threads]) => threads)
      .reduce((a, b) => a + b, 0);

    const currentLayout = ns.stanek
      .activeFragments()
      .map(({ x, y, rotation, id }) => [x, y, rotation, id] as FragmentPosition);

    const focus = getFocus(ns, resetInfo);
    const width = ns.stanek.giftWidth();
    const height = ns.stanek.giftHeight();
    const layout = getLayout(focus, width, height);

    if (!areLayoutsSame(currentLayout, layout)) {
      // 10s cooldown on swaps to prevent thrashing
      if (Date.now() - lastUpdate >= 10000) {
        setupGift(ns, layout);
        lastUpdate = Date.now();
      }
    }
    ns.print('FOCUS: ' + focus);

    const coords = ns.stanek
      .activeFragments()
      .filter((fragment) => fragment.type !== ns.enums.FragmentType.Booster)
      .flatMap(({ x, y }) => [x, y]);

    if (coords.length > 0) {
      // Get target RAM usage
      const { stanekRam } = getRamAllowances(ns);
      const desiredThreads = Math.floor(stanekRam / RAM_PER_SHARE);
      ns.print('Current threads: ' + currentThreads + '/' + desiredThreads);
      if (currentThreads < desiredThreads) {
        let threadsNeeded = desiredThreads - currentThreads;
        const workerRam = getWorkerRam(ns, CHARGE);
        for (const [hostname, ram] of Object.entries(workerRam)) {
          const threads = Math.min(Math.floor(ram / RAM_PER_SHARE), threadsNeeded);
          if (threads) {
            const pid = ns.exec(CHARGE, hostname, { threads, temporary: true }, ...coords);
            if (pid !== 0) {
              threadsNeeded -= threads;
              chargeThreads.set(pid, threads);
              if (!threadsNeeded) {
                break;
              }
            }
          }
        }
      }
    }
    putPlayerData(ns, {
      stanekLayout: {
        width: ns.stanek.giftWidth(),
        height: ns.stanek.giftHeight(),
        fragments: ns.stanek.activeFragments(),
      },
      fragmentMultipliers: getFragmentMultipliers(ns),
    });
    await ns.sleep(50);
  }
}
