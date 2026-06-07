import { getMoneyData, putMoneyData } from '../lib/data-store';
import { getServices } from '../lib/service-api';
import { Timeline } from '../lib/timeline';

class Timer {
  ns: NS;
  interval: number;
  maxInterval: number | null;
  nextProc: number;

  constructor(ns: NS, interval = 50, maxInterval = null) {
    this.ns = ns;
    this.interval = +interval;
    this.maxInterval = maxInterval && +maxInterval;
    this.nextProc = Date.now();
  }

  async next() {
    const delay = Math.max(0, Date.now() - this.nextProc);
    await this.ns.sleep(delay);
    this.nextProc = Date.now() + this.interval;
  }

  backoff() {
    if (typeof this.maxInterval !== 'number')
      throw new Error('Backoff only works for timers with a maxInterval');
    this.interval = Math.min(this.interval * 2, this.maxInterval);
  }

  reset() {
    if (typeof this.maxInterval !== 'number')
      throw new Error('Backoff only works for timers with a maxInterval');
    this.interval = 1;
  }
}

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const moneyTimeline = new Timeline();
  const theftTimeline = new Timeline();
  const timer = new Timer(ns);

  let estTotalGain = 0;
  let prevMoney = 0;

  while (true) {
    const scheduler = ns.getRunningScript('/bin/scheduler.ts', 'home');
    if (scheduler == null) return;
    const timestamp = Date.now();
    const money = ns.getServerMoneyAvailable('home');
    const {
      thiefReferenceWindow = 60,
      hacknetIncome = 0,
      gangIncome = 0,
      stockIncome = 0,
    } = getMoneyData(ns);
    const {
      onlineMoneyMade,
      offlineMoneyMade,
      onlineRunningTime,
      offlineRunningTime,
    } = scheduler;
    const moneyMade = onlineMoneyMade + offlineMoneyMade;
    const timeSpent = onlineRunningTime + offlineRunningTime;
    const incomeWindow = Math.min(timeSpent, thiefReferenceWindow);

    if (money > prevMoney)
      // Skip ticks where a purchase is made
      estTotalGain += money - prevMoney;
    prevMoney = money;

    moneyTimeline.addPoint(timestamp, estTotalGain);
    theftTimeline.addPoint(timestamp, moneyMade);

    const moneyAtStartOfWindow = theftTimeline.findValue(
      timestamp - incomeWindow * 1000,
    );
    const angel = getServices(ns).find((service) => service.name === 'angel');
    const theftIncome = angel?.allowed
      ? (getMoneyData(ns).theftIncome ?? 0)
      : (moneyMade - moneyAtStartOfWindow) / incomeWindow;
    const referenceIncome =
      theftIncome + hacknetIncome + gangIncome + stockIncome || 0.01;

    putMoneyData(ns, {
      money,
      theftIncome,
      hacknetIncome,
      gangIncome,
      stockIncome,
      referenceIncome,
    });

    await timer.next();
  }
}
