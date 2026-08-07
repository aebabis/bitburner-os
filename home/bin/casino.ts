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

const getButton = (content: string) =>
  [...globalThis['document'].querySelectorAll('button')].find(
    (button) => button.innerText === content,
  );

const atCoinFlipGame = () => getButton('Head!') != null;

const goToCoinFlipGame = async (ns: NS) => {
  ns.toast('Go to coin flip game');
  await ns.sleep(5000);
};

const setWager = async (amount: number) => {
  const input = globalThis['document'].querySelector('input')!;
  await input[Object.keys(input)[1]].onChange({ isTrusted: true, target: { value: `${amount}` } });
};

const click = (button: HTMLButtonElement) => {
  button[Object.keys(button)[1]].onClick({ isTrusted: true });
};

const HEADS = 0;
const TAILS = 1;
type Flip = typeof HEADS | typeof TAILS;

const playCoinFlips = async (ns: NS) => {
  const sequence: Flip[] = getBadRngSequence().map((v) => (v < 0.5 ? HEADS : TAILS));
  const setupRun: Flip[] = [];

  let foundRun = false;

  ns.print(sequence);

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

  let start = Date.now();
  let games = 0;
  while (true) {
    while (!atCoinFlipGame()) await goToCoinFlipGame(ns);

    if (foundRun) {
      const next = sequence.shift()!;
      sequence.push(next);
      await setWager(10000);
      if (next === HEADS) {
        click(getButton('Head!')!);
      } else {
        click(getButton('Tail!')!);
      }
    } else {
      setWager(1);
      click(getButton('Head!')!);
      await ns.sleep(0);
      const h4 = [...globalThis['document'].querySelectorAll('h4')].at(-1)!;
      setupRun.push(h4.innerText === 'win!' ? HEADS : TAILS);
      await checkPrediction();
    }

    games++;
    const time = Date.now() - start;
    const rate = games / (time / 1000);
    ns.clearLog();
    ns.print(ns.format.number(rate) + 'Hz');
    ns.print('$' + ns.format.number(rate * 10000) + '/s');
    await ns.sleep(0);
  }
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  await playCoinFlips(ns);
}
