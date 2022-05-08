import { getRamData } from './lib/data-store';
import { putMoneyData } from './lib/data-store';

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

class Timeline {
    constructor(history = 60100) {
        this.samples = [];
        this.history = history;
    }

    addPoint(timestamp, value) {
        const { samples, history } = this;
        const prev = samples[samples.length - 1]?.value || 0;
        const delta = value - prev;
        samples.push({ timestamp, value, delta });
        while (samples[1] != null && samples[1].timestamp < timestamp - history)
            samples.shift();
    }

    findValue(timestamp) {
        const terpolate = (s1, s2, timestamp) => {
            const portion = (timestamp - s1.timestamp) / (s2.timestamp - s1.timestamp);
            return s1.value + portion * (s2.value - s1.value);
        };

        const { samples } = this;
        let s2 = samples[samples.length - 1];
        for (let i = samples.length - 2; i >= 0; i--) {
            const s1 = samples[i];
            if (s1.timestamp < timestamp) {
                return terpolate(s1, s2, timestamp);
            }
            s2 = s1;
        }
        if (samples.length >= 2) {
            return terpolate(samples[0], samples[samples.length - 1], timestamp);
        }
        return 0;
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
        const timestamp = Date.now();
        const { money } = ns.getPlayer();
        const { onlineMoneyMade } = ns.getRunningScript('/bin/scheduler.js', 'home');

        if (money > prevMoney) {// Skip ticks where a purchase is made
            estTotalGain += (money - prevMoney);
            prevMoney = money;
        }

        moneyTimeline.addPoint(timestamp, estTotalGain);
        theftTimeline.addPoint(timestamp, onlineMoneyMade);

        const theftIncome60s = onlineMoneyMade - theftTimeline.findValue(timestamp - 60000);
        const theftIncome = theftIncome60s / 60;
        const { totalMaxRam } = getRamData(ns);
        const theftRatePerGB = theftIncome / totalMaxRam;
        
        const income1s  = estTotalGain - moneyTimeline.findValue(timestamp - 1000);
        const income5s  = estTotalGain - moneyTimeline.findValue(timestamp - 5000);
        const income10s = estTotalGain - moneyTimeline.findValue(timestamp - 10000);
        const income30s = estTotalGain - moneyTimeline.findValue(timestamp - 30000);
        const income60s = estTotalGain - moneyTimeline.findValue(timestamp - 60000);
        const income = income60s/60 || income30s/30 || income10s/10 || income5s/5 || income1s;

        putMoneyData(ns, {
            money,
            income, income1s, income5s, income10s, income30s, income60s,
            theftIncome, theftIncome60s, theftRatePerGB
        });

        ns.clearLog();
        ns.print('MONEY: ' + ns.nFormat(money,     '0.00a'));
        ns.print('   1s: ' + ns.nFormat(income1s||0,  '0.00a'));
        ns.print('   5s: ' + ns.nFormat(income5s||0,  '0.00a'));
        ns.print('  10s: ' + ns.nFormat(income10s||0, '0.00a'));
        ns.print('  30s: ' + ns.nFormat(income30s||0, '0.00a'));
        ns.print('  60s: ' + ns.nFormat(income60s||0, '0.00a'));
        ns.print('/GB-s: ' + ns.nFormat(theftRatePerGB||0, '0.00a'));

        await timer.next();
    }
}
