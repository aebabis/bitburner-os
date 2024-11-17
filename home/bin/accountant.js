import { getRamData } from '/lib/data-store';
import { putMoneyData } from '/lib/data-store';
import { Timeline } from '/lib/timeline';

class Timer {
    constructor(ns, interval=50, maxInterval=null) {
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

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const moneyTimeline = new Timeline();
    const theftTimeline = new Timeline();
    const timer = new Timer(ns);

    let estTotalGain = 0;
    let prevMoney = 0;

    while (true) {
        const scheduler = ns.getRunningScript('/bin/scheduler.js', 'home');
        if (scheduler == null)
            return;
        const timestamp = Date.now();
        const { money } = ns.getPlayer();
        const { onlineMoneyMade, offlineMoneyMade } = scheduler;
        const moneyMade = onlineMoneyMade + offlineMoneyMade;

        if (money > prevMoney) // Skip ticks where a purchase is made
            estTotalGain += (money - prevMoney);
        prevMoney = money;

        moneyTimeline.addPoint(timestamp, estTotalGain);
        theftTimeline.addPoint(timestamp, moneyMade);

        const theftIncome60s = moneyMade - theftTimeline.findValue(timestamp - 60000);
        const theftIncome = theftIncome60s / 60;
        const { totalMaxRam } = getRamData(ns);
        const theftRatePerGB = theftIncome / totalMaxRam;
        
        const income1s  = estTotalGain - moneyTimeline.findValue(timestamp - 1000);
        const income5s  = estTotalGain - moneyTimeline.findValue(timestamp - 5000);
        const income10s = estTotalGain - moneyTimeline.findValue(timestamp - 10000);
        const income30s = estTotalGain - moneyTimeline.findValue(timestamp - 30000);
        const income60s = estTotalGain - moneyTimeline.findValue(timestamp - 60000);
        const income5m  = estTotalGain - moneyTimeline.findValue(timestamp - 5 * 60000);
        const income = income5m/5/60 || income60s/60 || income30s/30 || income10s/10 || income5s/5 || income1s;

        putMoneyData(ns, {
            money,
            income, income1s, income5s, income10s, income30s, income60s,
            theftIncome, theftIncome60s, theftRatePerGB
        });

        ns.clearLog();
        ns.print('MONEY: ' + ns.formatNumber(money,     '0.00a'));
        ns.print('Total gain: ' + ns.formatNumber(estTotalGain,     '0.00a'));
        ns.print('   1s: ' + ns.formatNumber(income1s||0,  '0.00a'));
        ns.print('   5s: ' + ns.formatNumber(income5s||0,  '0.00a'));
        ns.print('  10s: ' + ns.formatNumber(income10s||0, '0.00a'));
        ns.print('  30s: ' + ns.formatNumber(income30s||0, '0.00a'));
        ns.print('  60s: ' + ns.formatNumber(income60s||0, '0.00a'));
        ns.print('   5m: ' + ns.formatNumber(income5m||0, '0.00a'));
        ns.print('/GB-s: ' + ns.formatNumber(theftRatePerGB||0, '0.00a'));

        await timer.next();
    }
}
