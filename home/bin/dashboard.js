import { THREADPOOL } from './etc/config';
import { getPath } from './lib/backdoor.js';
import { getStaticData, getMoneyData, getPlayerData } from './lib/data-store';
import { GrowingWindow, DynamicWindow, renderWindows } from './lib/layout';
import { getTailModal, getModalColumnCount } from './lib/modal';
import { table } from './lib/table';
import { getServices } from './lib/service-api';
import { C, BG, MEDIUM, BRIGHT } from './lib/colors';
import { getTimeEstimates, getRepNeeded, getGoalCost, hasBitNode } from './lib/query-service';
import { getSkillFormulas } from './lib/formulas';

const doc = eval('document');
const H = BRIGHT.BOLD;

const getSchedulerTable = (ns) => {
    const { city, bitNodeN } = ns.getPlayer();
    const scheduler = ns.getRunningScript('/bin/scheduler.js', 'home');
    const { theftIncome=0, theftRatePerGB=0, estimatedStockValue=0 } = getMoneyData(ns);
    const { onlineExpGained, onlineRunningTime } = scheduler;
    const time = ns.nFormat(onlineRunningTime, '00:00:00');
    const theft = ns.nFormat(theftIncome, '$0.0a').padStart(6)+'/s  ';
    const theftRate = ns.nFormat(theftRatePerGB, '$0.0a').padStart(6)+'/GBs';
    const exp = ns.nFormat(onlineExpGained, '0.0a');
    const stock = ns.nFormat(estimatedStockValue, '$0.0a');
    const { numPeopleKilled } = ns.getPlayer();
    return H+table(ns, null,
        [['BN'+bitNodeN, ''],
        [H('UPTIME'), time],
        [H('CITY'), city],
        [H('THEFT'), theft],
        ['', theftRate],
        [H('KILLS'), numPeopleKilled],
        [H('STOCK'), stock],
        [H('EXP'), exp]]);
};

const getStatTable = (ns) => {
  const WIDTH = 20;
  const { calculateSkill, calculateExp } = getSkillFormulas(ns);
  const { hp, money, skills, exp, mults } = ns.getPlayer();
  const row = (c1, t1, c2, t2) => {
    const fill = WIDTH - t1.toString().length - t2.toString().length;
    return ' ' + c1 + t1 + ' '.repeat(fill) + c2 + t2 + ' ';
  };

  const computeProgress = (sName) => {
    const ex = exp[sName];
    const mult = mults[sName];
    const skill = calculateSkill(ex, mult);
    const t1 = calculateExp(skill, mult);
    const t2 = calculateExp(skill+1, mult);
    return (ex-t1)/(t2-t1);
  }

  const progressBar = (portion, size) => {
    const num = size * portion;
    const whole = ~~num;
    const frac = Math.round((num - whole) * 8);
    const sp = ' '.repeat(20 - whole - 1);
    return C(238)('█'.repeat(whole) + ' ▏▎▍▌▋▊▉█'[frac] + sp);
  };

  const abbr = (str) => str[0].toUpperCase() + str[1] + str[2];

  const output = [
    row(C(133).BOLD, 'HP', C(170), `${hp.current}/${hp.max}`),
    row(C(223).BOLD, 'Money', C(223), '$'+ns.formatNumber(money)),
    row(C(36).BOLD, 'Hack', C(72), skills.hacking),
    ' ' + progressBar(computeProgress('hacking'), WIDTH) + ' ',
    row(C(251).BOLD, abbr('strength'), C(251), skills.strength),
    ' ' + progressBar(computeProgress('strength'), WIDTH) + ' ',
    row(C(251).BOLD, abbr('defense'), C(251), skills.defense),
    ' ' + progressBar(computeProgress('defense'), WIDTH) + ' ',
    row(C(251).BOLD, abbr('dexterity'), C(251), skills.dexterity),
    ' ' + progressBar(computeProgress('dexterity'), WIDTH) + ' ',
    row(C(251).BOLD, abbr('agility'), C(251), skills.agility),
    ' ' + progressBar(computeProgress('agility'), WIDTH) + ' ',
    row(C(251).BOLD, abbr('charisma'), C(251), skills.charisma),
    ' ' + progressBar(computeProgress('charisma'), WIDTH) + ' ',
  ];

  return output.join('\n');
}

const backdoorPath = (ns) => {
    const SPACES = ' '.repeat(' connect powerhouse-fitness '.length) + '\n';
    const HEAD = ` ${BRIGHT.BOLD('BACKDOOR HELPER')} \n`;
    const path = getPath(ns);
    if (path == null) {
        return HEAD + ' (no available servers) ' + SPACES.repeat(2) + '\n\n\n\n';
    } else {
        const rows = [...path.map(s => s === 'home' ? ' home' : ` connect ${s} `), ' backdoor'];
        if (rows.length >= 6) {
            rows.length = 5;
            rows.push(' ...');
        } else {
            for (let i = 0; i < rows.length - 6; i++)
                rows.push(' ');
        }
        return HEAD + rows.join('\n');
    }
};

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
    const data = threadpools(ns);
    const left = data.slice(0, half);
    const right = data.slice(half);
    const rows = left.map((list, i) => [...list, ...(right[i]||['',''])]);
    return BRIGHT.BOLD(' SERVERS ') + '\n' + table(ns, null, rows);
};

const goalsTable = (ns) => {
    const {
        requiredJobRam,
        targetFaction,
        targetAugmentations,
    } = getStaticData(ns);
    if (targetAugmentations == null) {
        return table(ns, ['GOALS'], [
            [`${requiredJobRam}GB on ${THREADPOOL}-01`],
            ['Run augmentation suite'],
        ], {colors: true});
    } else {
        const rows = [
            ['Join ' + targetFaction],
            ['Gain ' + getRepNeeded(ns) + ' rep'],
            ...targetAugmentations.map(aug=>[aug]),
        ];
        return table(ns, ['GOALS'], rows, {colors: true});
    }
};

const moneyTable = (ns) => {
    const moneyData = getMoneyData(ns);
    if (moneyData == null) {
        return ` ${H('INCOME')} \n ${MEDIUM(loading)} `;
    }
    const { moneyTime, repTime } = getTimeEstimates(ns) || 0;
    const goalCost = getGoalCost(ns);
    const { income1s=0, income10s=0, income60s=0 } = moneyData;
    const rows = [
        [' 1s', ns.nFormat(income1s, '$0.0a').padStart(8)],
        ['10s', ns.nFormat(income10s, '$0.0a').padStart(8)],
        ['60s', ns.nFormat(income60s, '$0.0a').padStart(8)],
        ['Goal',ns.nFormat(goalCost||0, '$0.0a').padStart(8)],
        ['   $', ns.nFormat(moneyTime||100*60*60, '00:00:00').padStart(8)],
        ['   r', ns.nFormat(repTime||100*60*60, '00:00:00').padStart(8)],
    ];
    return ` ${H('INCOME')} \n` + table(ns, null, rows);
};

const workTable = (ns) => {
    const { factionRep = {}, currentWork } = getPlayerData(ns);
    const { location } = ns.getPlayer();
    const WORK = H('WORK');
    if (!hasBitNode(ns, 4))
        return ` ${WORK} \n ${location} `;
    if (currentWork == null)
        return ` ${WORK} \n ${MEDIUM('(idle)')} `
    const {
        type,
        crimeType,
        companyName,
        factionName,
        workMoneyGained,
        workRepGained,
        workHackExpGained,
        workStrExpGained,
        workDefExpGained,
        workDexExpGained,
        workAgiExpGained,
        workChaExpGained,
    } = currentWork;
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
    if (type === 'FACTION') {
        const rep = Math.floor(factionRep[factionName]);
        return ` ${WORK} \n ${factionName} (${rep}rep) \n${rows}`;
    } else if (type === 'COMPANY') {
        return ` ${WORK} \n Working at ${companyName} \n${rows}`;
    } else if (type === 'CRIME') {
        return ` ${WORK} \n ${crimeType} \n${rows}`;
    }
    return ` ${WORK} \n ${type} \n ${location} \n${rows}`;
};

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tail();
    const windows = [
        new GrowingWindow(() => getSchedulerTable(ns)),
        new GrowingWindow(() => getStatTable(ns)),
        new GrowingWindow(() => table(ns, ['SERVICES', ''],
            getServices(ns).map(({name, status})=>[name, status]), {colors:true})),
        new GrowingWindow(() => backdoorPath(ns)),
        new GrowingWindow(() => threadpoolTable(ns)),
        new GrowingWindow(() => goalsTable(ns)),
        new GrowingWindow(() => moneyTable(ns)),
        new GrowingWindow(() => workTable(ns)),
        // new DynamicWindow((width, height) => tailLogs(ns, width, height), 80, 10),
    ];
    while (true) {
        try {
            const modal = await getTailModal(ns);
            const width = await getModalColumnCount(ns);

            if (width != null) {
                const textField = renderWindows(windows, width);

                ns.clearLog();
                textField.split('\n').forEach(line=>ns.print(line));
                await ns.sleep(1);

                // colorize(modal.bottom);
            }
        } catch (error) {
            console.error(error);
        }
        await ns.sleep(1000);
    }
}