import { KEYWORD, NORMAL } from './lib/colors';
import { table } from './lib/table';

const COMMANDS = {
    start: 'Boots the system and services',
    stop: 'Kill all scripts on all services',
    restart: 'Kills all scripts then starts again',
    services: 'View and manually control services',
};

const SHORTHAND = {
    c: 'connect',
    bd: 'backdoor',
    h: 'home',
    b: 'buy port programs',
};

const ALIASES = {
    // Main
    start: './start.js',
    stop: 'killall; ./stop.js',
    restart: 'killall; ./restart.js',
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
    servers: 'dispatch servers.js',
    update: 'killall; ./update.js',
}

/** @param {NS} ns */
export async function main(ns) {
    let str = '\n';
    for (const [command, desc] of Object.entries(COMMANDS))
        str += '\n' + KEYWORD.BOLD + command + '\n  ' + NORMAL + desc;
    str += '\n\n';
    str += Object.entries(SHORTHAND).map(([command, desc])=>
        [`${KEYWORD}${command}${NORMAL} - ${desc}`]).join('    ');
    ns.tprint(str);
}