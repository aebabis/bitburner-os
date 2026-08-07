import { putMoneyData } from '../lib/data-store';
import { disableService } from '../lib/service-api';

const getBadRngSequence = () => {
  const m = 1024;
  const a = 341;
  const c = 1;

  let x = 0; // In-game PRNG has random seed, but 0 is a possible value

  const values: number[] = [];
  for (let i = 0; i < m; i++) {
    x = (a * x + c) % m;
    values.push(x / m);
  }
  return values;
};

const makeWHRNG = (ms: number) => {
  if (Number.isNaN(ms)) {
    throw new Error('NaN input');
  }
  const seed = (ms / 1000) % 30000;
  let s1 = seed;
  let s2 = seed;
  let s3 = seed;

  return () => {
    s1 = (171 * s1) % 30269;
    s2 = (172 * s2) % 30307;
    s3 = (170 * s3) % 30323;
    const rand = (s1 / 30269.0 + s2 / 30307.0 + s3 / 30323.0) % 1.0;
    return Math.floor(rand * 37);
  };
};

const getButton = (content: string | RegExp) =>
  [...globalThis['document'].querySelectorAll('button')].find(({ innerText }) =>
    typeof content === 'string' ? innerText === content : innerText.match(content),
  );

const getNavButton = (content: string) => {
  const buttons = [
    ...globalThis['document'].querySelectorAll('[role="button"]'),
  ] as HTMLDivElement[];
  return buttons.find((button) => {
    return button.innerText === content || button.querySelector(`[aria-label="${content}"]`);
  });
};

const getElem = (type: 'span' | 'h4' | 'p', content: string | RegExp) =>
  [...globalThis['document'].querySelectorAll(type)].find(({ innerText }) =>
    typeof content === 'string' ? innerText === content : innerText.match(content),
  );

const atCoinFlipGame = () => getButton('Head!') != null;
const atRouletteTable = () => getButton('Red') != null;

const goTowardCasino = (ns: NS) => {
  const unfocusButton = getButton(/something else/);
  if (unfocusButton) {
    unfocusButton.click();
    return false;
  } else if (getNavButton('Travel') == null) {
    getNavButton('World')!.click();
    return false;
  } else if (ns.getPlayer().city !== 'Aevum') {
    const A = getElem('span', 'A');
    if (A) A.click();
    else getNavButton('Travel')!.click();
    return false;
  } else if (getElem('h4', 'Iker Molina Casino') == null) {
    if (getElem('p', 'Aevum') == null) {
      getNavButton('City')!.click();
    } else {
      getElem('span', '¢')!.click();
    }
    return false;
  }
  return true;
};

const goTowardCoinFlipGame = (ns: NS) => {
  if (goTowardCasino(ns)) {
    const coinFlipButton = getButton('Play coin flip');
    if (coinFlipButton) coinFlipButton.click();
    else getButton('Stop playing')!.click();
  }
};

const goTowardRouletteTable = (ns: NS) => {
  if (goTowardCasino(ns)) {
    const coinFlipButton = getButton('Play roulette');
    if (coinFlipButton) coinFlipButton.click();
    else getButton('Stop playing')!.click();
  }
};

const money = (ns: NS) => Math.floor(ns.getServerMoneyAvailable('home'));

const setWager = async (ns: NS, amount: number) => {
  if (amount > money(ns)) return false;
  const input = globalThis['document'].querySelector('input')!;
  await Promise.all([
    input[Object.keys(input)[1]].onChange({
      isTrusted: true,
      target: { value: `${amount}` },
    }),
    ns.sleep(0),
  ]);
  return amount <= money(ns);
};

const click = (button: HTMLButtonElement) => {
  button[Object.keys(button)[1]].onClick({ isTrusted: true });
};

const HEADS = 0;
const TAILS = 1;
type Flip = typeof HEADS | typeof TAILS;

const playCoinFlips = async (ns: NS, lose = false) => {
  const sequence: Flip[] = getBadRngSequence().map((v) => (v < 0.5 ? HEADS : TAILS));
  const setupRun: Flip[] = [];

  let foundRun = false;

  const checkPrediction = async () => {
    let safeguard = sequence.length;
    while (sequence.slice(0, setupRun.length).some((n, i) => n !== setupRun[i])) {
      sequence.push(sequence.shift()!);
      if (safeguard-- <= 0) {
        throw new Error('Failed to find sequence. Playing too fast?');
      }
    }
    if (setupRun.length >= 20) {
      foundRun = true;
      while (setupRun.length) {
        setupRun.shift();
        sequence.push(sequence.shift()!);
      }
    }
  };

  const metGoal = () => {
    if (lose) return money(ns) < -1e9;
    else return money(ns) >= 11e6;
  };

  let start = Date.now();
  let games = 0;
  let wins = 0;
  while (!metGoal()) {
    while (!atCoinFlipGame()) {
      goTowardCoinFlipGame(ns);
      await ns.sleep(0);
    }

    if (lose && ns.getServerMoneyAvailable('home') <= -1e9) {
      return;
    }

    if (foundRun) {
      const next = sequence.shift()!;
      sequence.push(next);
      await setWager(ns, 10000);
      const choice = lose ? ((1 - next) as Flip) : next;
      if (choice === HEADS) {
        click(getButton('Head!')!);
      } else {
        click(getButton('Tail!')!);
      }
      wins++;
    } else {
      await setWager(ns, 1);
      click(getButton('Head!')!);
      await ns.sleep(0);
      const h4 = [...globalThis['document'].querySelectorAll('h4')].at(-1)!;
      setupRun.push(h4.innerText === 'win!' ? HEADS : TAILS);
      await checkPrediction();
    }

    games++;
    const time = Date.now() - start;
    const rate = games / (time / 1000);
    const casinoIncome = rate * 10000;
    putMoneyData(ns, { casinoIncome });

    ns.clearLog();
    ns.print('$' + ns.format.number(wins * 10000));
    ns.print(ns.format.number(rate) + 'Hz');
    ns.print('$' + ns.format.number(casinoIncome) + '/s');

    await ns.sleep(0);
  }
};

const playRoulette = async (ns: NS) => {
  let tableJoinTime = Date.now();

  let prngs: ReturnType<typeof makeWHRNG>[] = [];

  // Force reset PRNG
  while (true) {
    const term = getNavButton('Terminal');
    if (term != null) {
      term.click();
      break;
    }
    getNavButton('Hacking')!.click();
    await ns.sleep(0);
  }

  const buildPrngs = () => {
    const window = Date.now() - tableJoinTime;
    const seeds = Array(window + 1)
      .fill(0)
      .map((_, i) => tableJoinTime + i);
    return seeds.map((time) => makeWHRNG(time));
  };

  const getOutcome = () => {
    const outcomeElem = getElem('h4', /^[0-9]{1,2}[RB]?$/);
    if (outcomeElem == null) {
      throw new Error('Tried to view outcome prematurely');
    }
    const outcome = parseInt(outcomeElem.innerText);
    if (!Number.isInteger(outcome) || outcome < 0 || outcome > 36) {
      throw new Error('Illegal outcome. Probably scraped page incorrectly');
    }
    return outcome;
  };

  const play = async (choice: number, wager = 1) => {
    if (!atRouletteTable()) return null;
    if (!(await setWager(ns, wager))) return null;
    if (!atRouletteTable()) return null;
    click(getButton(`${choice}`)!);
    if (getElem('h4', 'playing') == null) return null;
    while (getElem('h4', 'playing')) await ns.sleep(0);
    const outcome = getOutcome();
    ns.print('Selection: ' + choice);
    ns.print('Outcome:   ' + outcome + ` (${outcome === choice ? 'win' : 'lose'})`);
    return outcome;
  };

  const update = async (choice: number, outcome: number) => {
    const won = outcome === choice;
    ns.print('Outcome: ' + outcome);
    ns.print(
      `Pruning ${prngs.length} candidate PRNGs based on outcome: ${outcome} ${won ? 'won' : 'lost'}`,
    );
    let lastSleep = Date.now();
    const newPrngs = [] as typeof prngs;
    for (const prng of prngs) {
      if (won) {
        if (prng() === 0) newPrngs.push(prng);
      } else {
        while (true) {
          const value = prng();
          if (value === choice) continue;
          if (value === outcome) newPrngs.push(prng);
          break;
        }
      }
      if (Date.now() - lastSleep > 200) {
        await ns.sleep(0);
        lastSleep = Date.now();
      }
    }
    prngs = newPrngs;
    ns.print(`Possible PRNGs pruned to ${prngs.length}`);
    if (prngs.length === 0) {
      const leaveToResetPrng = getButton('Return to World');
      if (leaveToResetPrng) click(leaveToResetPrng);
    }
  };

  while (!atRouletteTable()) {
    tableJoinTime = Date.now();
    goTowardRouletteTable(ns);
    await ns.sleep(0);
  }

  while (true) {
    if (prngs.length === 0) prngs = buildPrngs();

    const knowsFuture = prngs.length === 1;
    const choice = knowsFuture ? prngs[0]() : 0;
    const wager = knowsFuture ? 10e6 : 1;

    const outcome = await play(choice, wager);

    const accusation = getElem('span', /cheater/);
    if (accusation) {
      let container: HTMLElement | null = accusation;
      while (container != null) {
        const closeButton = container.querySelector('button');
        if (closeButton) {
          closeButton.click();
          break;
        }
        container = container['parentElement'];
      }
      disableService(ns);
      return;
    }

    if (outcome == null) return;

    if (knowsFuture) {
      // If the game cheated, pull numbers until we catch up
      // to the bad draw
      if (outcome !== choice) {
        while (true) {
          const next = prngs[0]();
          if (next === outcome) break;
          else if (next !== choice) throw new Error('Analysis broken');
        }
      }
    } else {
      await update(choice, outcome);
    }

    await ns.sleep(0);
  }
};

export async function main(ns: NS) {
  const { debt } = ns.flags([['debt', false]]);
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.ui.resizeTail(100, 100);
  ns.ui.moveTail(0, 1000);
  if (debt === true) {
    await playCoinFlips(ns, debt);
  } else {
    if (money(ns) < 10e6) await playCoinFlips(ns);
    await playRoulette(ns);
  }
  putMoneyData(ns, { casinoIncome: 0 });
  ns.ui.closeTail();
}
