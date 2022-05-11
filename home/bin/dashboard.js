import { THREADPOOL } from './etc/config';
import { getPath } from './lib/backdoor.js';
import { getStaticData, getMoneyData, getPlayerData } from './lib/data-store';
import { renderWindows } from './lib/layout';
import { getTailModal, getModalColumnCount } from './lib/modal';
import { table } from './lib/table';
import { getServices } from './lib/service-api';

const getSchedulerTable = (ns) => {
    const { city } = ns.getPlayer();
    const scheduler = ns.getRunningScript('/bin/scheduler.js', 'home');
    const { theftIncome=0, theftRatePerGB=0, estimatedStockValue=0 } = getMoneyData(ns);
    const { onlineExpGained, onlineRunningTime } = scheduler;
    const time = ns.nFormat(onlineRunningTime, '00:00:00');
    const theft = ns.nFormat(theftIncome, '$0.0a').padStart(6)+'/s  ';
    const theftRate = ns.nFormat(theftRatePerGB, '$0.0a').padStart(6)+'/GBs';
    const exp = ns.nFormat(onlineExpGained, '0.0a');
    const stock = ns.nFormat(estimatedStockValue, '$0.0a');
    const { numPeopleKilled } = ns.getPlayer();
    return table(ns, null,
        [['UPTIME', time],
        ['CITY', city],
        ['THEFT', theft],
        ['', theftRate],
        ['KILLS', numPeopleKilled],
        ['STOCK', stock],
        ['EXP', exp]]);
};

const backdoorPath = (ns) => {
    const SPACES = ' '.repeat(' connect powerhouse-fitness '.length) + '\n';
    const HEAD = ' BACKDOOR HELPER \n';
    const path = getPath(ns);
    if (path == null) {
        return HEAD + ' (no available servers) ' + SPACES.repeat(2) + '\n\n\n\n';
    } else {
        const extraRowCount = Math.max(0, 5 - path.length);
        const text = path.slice(0, 5).map(s => s === 'home' ? ' home' : ` connect ${s} `).join('\n') + '\n backdoor'
            + '\n'.repeat(extraRowCount);
        return HEAD + text;
    }
};

const tailLogs = (ns, width) => {
    width = Math.min(width, 80);
    return ns.getRunningScript('/bin/logger.js', 'home').logs
        .slice(-10).map(x=>x.split('\n')[0])
        .map(line => line.slice(line.indexOf(' ')+1))
        .map(line => line.length < width - 8 ? line : line.slice(0, width-8)+'...')
        .map(line => ` ${line} `)
        .map(line => line.padEnd(width - 6));
};

const process = (table) => typeof table === 'string' ? table.split('\n') : table;

const GB = 1000 ** 3;

const threadpoolRow = (ns, server) => {
	const { hostname, ramUsed, maxRam } = server;
    const n = hostname.split('-')[1]||'?';
	const ram = `${ns.nFormat(ramUsed*GB, '0b').padStart(5)}/${ns.nFormat(maxRam*GB, '0b').padEnd(5)}`;
	return [n, ram];
};

/** @param {NS} ns **/
const threadpools = (ns) => {
    const names = Array(ns.getPurchasedServerLimit()).fill(null)
        .map((_,i)=>(i+1).toString().padStart(2, '0'))
        .map(num =>`${THREADPOOL}-${num}`);
    return names
        .map(hostname=>{try{return ({
            hostname,
            ramUsed: ns.getServerUsedRam(hostname),
            maxRam: ns.getServerMaxRam(hostname),
        });}catch{return null}})
        .filter(Boolean)
        .map(server=>threadpoolRow(ns, server));
};

const threadpoolTable = (ns) => {
    const { purchasedServerLimit } = getStaticData(ns);
    const half = Math.ceil(purchasedServerLimit / 2);
    const rows = threadpools(ns);
    const left = rows.slice(0, half);
    const right = rows.slice(half);
    return table(ns, ['SERVERS', '', '', ''], 
        left.map((list, i) => [...list, ...(right[i]||['',''])]));
};

const goalsTable = (ns) => {
    const { targetFaction, targetAugmentations } = getStaticData(ns);
    if (targetAugmentations == null)
        return '';
    const rows = [
        ['Join ' + targetFaction],
        ...targetAugmentations.map(aug=>[aug]),
    ];
    return table(ns, ['GOALS'], rows);
};

const moneyTable = (ns) => {
    const moneyData = getMoneyData(ns);
    if (moneyData == null) {
        return ' INCOME \n (loading) ';
    }
    const { income1s=0, income10s=0, income60s=0, costToAug=0, timeToAug } = moneyData;
    const rows = [
        [' 1s', ns.nFormat(income1s, '$0.0a').padStart(8)],
        ['10s', ns.nFormat(income10s, '$0.0a').padStart(8)],
        ['60s', ns.nFormat(income60s, '$0.0a').padStart(8)],
        ['Aug', ns.nFormat(costToAug||0, '$0.0a').padStart(8)],
        ['   ', ns.nFormat(timeToAug||100*60*60, '00:00:00').padStart(8)],
    ];
    return ' INCOME \n' + table(ns, null, rows);
};

const workTable = (ns) => {
    const { factionRep = {} } = getPlayerData(ns);
    const {
        workType,
        crimeType,
        currentWorkFactionName,
        companyName,
        workMoneyGained,
        workRepGained,
        workHackExpGained,
        workStrExpGained,
        workDefExpGained,
        workDexExpGained,
        workAgiExpGained,
        workChaExpGained,
    } = ns.getPlayer();
    const gains = [
        ['$', workMoneyGained],
        ['Rep', workRepGained],
        ['Hack', workHackExpGained],
        ['Str', workStrExpGained],
        ['Def', workDefExpGained],
        ['Dex', workDexExpGained],
        ['Agi', workAgiExpGained],
        ['Cha', workChaExpGained],
    ].filter(([,x])=>!!x).map(([h,v]) => [h, ns.nFormat(v, '0.000a').padStart(8)]);
    const PAD = Math.max(0, 7-gains.length);
    const rows = table(ns, null, gains) + '\n'.repeat(PAD);
    if (workType === 'Working for Faction') {
        const rep = factionRep[currentWorkFactionName]?.toFixed(3);
        return ` WORK \n ${currentWorkFactionName} (${rep}rep) \n${rows}`;
    } else if (workType === 'Working for Company') {
        return ` WORK \n Working at ${companyName} \n${rows}`;
    } else if (crimeType != null) {
        return ` WORK \n ${crimeType.slice(7)} \n${rows}`;
    }
    return ` WORK \n ${location} \n${rows}`;
};

const colorize = (modal) => {
    const REGEX = /([^─-◿⊗ ]*)( *)([─-◿⊗]*)(.*)/;
    const container = modal.querySelector('.react-resizable');
    let dupe = container.querySelector('.MuiBox-root:last-child');
    if (!dupe) {
        dupe = document.createElement('div');
        dupe.classList.add('MuiBox-root');
        dupe.classList.add('css-0');
        dupe.classList.add('windower');
        // dupe.style.position = 'absolute';
        // dupe.style.background = 'black';
        // dupe.style.maxHeight = 'calc(100% - 40px)';
        // dupe.style.overflow = 'hidden';
        container.append(dupe);
    }
    const root = modal.querySelector('.MuiBox-root');
    root.style.display = 'none';
    dupe.innerText = '';
    root.querySelectorAll('p').forEach((p) => {
        let text = p.innerText;
        const newP = document.createElement('p');
        newP.className = p.className;
        dupe.append(newP);
        do {
            const [, non, w, color, rest] = text.match(REGEX);
            if (non) {
            if (non.match(/^[A-Z]+$/)) {
                const strong = document.createElement('strong');
                strong.innerText = non;
                newP.append(strong);
            } else
                newP.append(document.createTextNode(non));
            }
            if (w)
                newP.append(document.createTextNode(w));
            if (color) {
                const span = document.createElement('span');
                span.innerText = color;
                if (color === '●')
                    span.style.color = 'hsl(140, 35%, 45%)';
                else if (color === '⊗')
                    span.style.color = 'hsl(340, 65%, 55%)';
                else
                    span.style.color = 'hsl(280, 75%, 21%)';
                newP.append(span);
            }
            text = rest;
        } while (text);
    });
};

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tail();
    while (true) {
        const modal = await getTailModal(ns);
        const width = await getModalColumnCount(ns);
        if (width != null) {
            const text = [
                getSchedulerTable(ns),
                table(ns, ['SERVICES', ''], getServices(ns).map(({name, status})=>[name, status])),
                backdoorPath(ns),
                threadpoolTable(ns),
                goalsTable(ns),
                moneyTable(ns),
                tailLogs(ns, width),
                workTable(ns),
            ].map(process);
            const textField = renderWindows(text, width);

            ns.clearLog();
            textField.split('\n').forEach(line=>ns.print(line));
            await ns.sleep(1);

            colorize(modal);
        }
        await ns.sleep(1000);
    }
}
