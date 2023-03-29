import { KEYWORD, NORMAL } from './lib/colors';
import { table, transpose } from './lib/table';

const MAIN = {
    start: 'Boots the system and services',
    stop: 'Kill all scripts on all servers',
    restart: 'Kill all scripts and start again',
    services: 'View and manually control services',
};

const SHORTHAND = {
    c: 'connect',
    bd: 'backdoor',
    h: 'home',
    b: 'buy port programs',
};

const UTILITIES = {
    config: 'Global config variables',
    dispatch: 'Tell scheduler to run a program',
    liquidate: 'Sell all stocks and stop spending',
    nmap: 'Graphical network map',
    readme: 'View this help',
    servers: 'List non-purchased servers',
    update: 'Download most recent code from GitHub',
};

const ALIASES = {
    // Main
    start: 'home; ./start.js',
    stop: 'home; kill /bin/scheduler.js; ./stop.js',
    restart: 'home; kill /bin/scheduler.js; ./stop.js start.js',
    services: './services.js',

    // Shorthand
    c: 'connect',
    bd: 'backdoor',
    h: 'home',
    b: 'buy BruteSSH.exe; buy FTPCrack.exe; buy relaySMTP.exe; buy HTTPWorm.exe; buy SQLInject.exe',

    // Other utilities
    config: './config.js',
    dispatch: './lib/scheduler-delegate.js',
    liquidate: 'dispatch liquidate.js',
    nmap: 'dispatch nmap-gui.js',
    readme: './readme.js',
    servers: 'dispatch servers.js',
    update: 'home; killall; ./update.js',
}

const twoLine = (obj) => {
    let line1 = KEYWORD.BOLD;
    let line2 = NORMAL;
    for (const [command, desc] of Object.entries(obj)) {
        line1 += command + ' '.repeat(desc.length + 2 + 2);
        line2 += '  ' + desc + ' '.repeat(command.length + 2);
    }
    return line1 + '\n' + line2 + '\n';
}

const getLines = (commands) => {
    const lines = [];
    for (const [command, desc] of Object.entries(commands))
        lines.push(KEYWORD.BOLD + command, NORMAL + '  ' + desc);
    return lines;
}

const getHelp = (ns) => {
    const column1 = [
        ...getLines(MAIN),
        ' ',
        ...getLines(SHORTHAND),
    ];
    const column2 = getLines(UTILITIES);
    const iters = Math.max(column1.length, column2.length);
    const rows = [];
    for (let i = 0; i < iters; i++)
        rows.push([column1[i]||'', column2[i]||'']);
    return table(ns, ['', ''], rows);
}

const getAliases = (ns) => KEYWORD.BOLD+Object.entries(ALIASES)
    .map(([alias, command]) => `alias ${alias}=${JSON.stringify(command)}`)
    .join(';');

/** @param {NS} ns */
export async function main(ns) {
    const [command] = ns.args;
    if (command == null)
        ns.tprint('\n' + getHelp(ns) + '\n\n');
    else if (command === 'aliases')
        ns.tprint(getAliases(ns));
}