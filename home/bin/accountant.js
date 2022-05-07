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

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const samples = [];

    const timer = new Timer(ns);

    const terpolate = (s1, s2, timestamp) => {
        const portion = (timestamp - s1.timestamp) / (s2.timestamp - s1.timestamp);
        return s1.estGain + portion * (s2.estGain - s1.estGain);
    };

    const findValue = (timestamp) => {
        let s2 = samples[samples.length - 1];
        for (let i = samples.length - 2; i >= 0; i--) {
            const s1 = samples[i];
            if (s1.timestamp < timestamp) {
                return terpolate(s1, s2, timestamp);
            }
        }
        if (samples.length >= 2) {
            return terpolate(samples[0], samples[samples.length - 1], timestamp);
        }
        return 0;
    };

    let estGain = 0; // Lower-bound for money gained from all sources
    let prevMoney;
    while (true) {
        const timestamp = Date.now();
        const { money } = ns.getPlayer();
        //ns.getRunningScript('/bin/scheduler.js', 'home').onlineMoneyMade;

        const diff = money - prevMoney;
        if (diff > 0)
            estGain += diff;
        prevMoney = money;

        samples.push({ timestamp, money, estGain });

        while (samples[1] != null && samples[1].timestamp < timestamp - 60100)
            samples.shift();
        
        const income1s  = estGain - findValue(timestamp - 1000);
        const income5s  = estGain - findValue(timestamp - 5000);
        const income10s = estGain - findValue(timestamp - 10000);
        const income30s = estGain - findValue(timestamp - 30000);
        const income60s = estGain - findValue(timestamp - 60000);

        putMoneyData(ns, { money, income1s, income5s, income10s, income30s, income60s });

        ns.clearLog();
        ns.print('MONEY: ' + ns.nFormat(money,     '0.00a'));
        ns.print('   1s: ' + ns.nFormat(income1s||0,  '0.00a'));
        ns.print('   5s: ' + ns.nFormat(income5s||0,  '0.00a'));
        ns.print('  10s: ' + ns.nFormat(income10s||0, '0.00a'));
        ns.print('  30s: ' + ns.nFormat(income30s||0, '0.00a'));
        ns.print('  60s: ' + ns.nFormat(income60s||0, '0.00a'));

        await timer.next();
    }
}
