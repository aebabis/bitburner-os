import { nmap } from './lib/nmap';
import { defer } from './boot/defer';
import { putHostnames, putStaticData, putMoneyData } from './lib/data-store';

import { PORT_RUN_CONFIG, PORT_SERVICES_LIST } from './etc/ports';
const PERSISTENT_PORTS = [PORT_RUN_CONFIG, PORT_SERVICES_LIST];

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    // Clear all ports except configuration ports
    ns.tprint('Clearing ports');
    for (let i = 1; i <= 20; i++)
        if (!PERSISTENT_PORTS.includes(i))
            ns.clearPort(i);

    // Generate list of hostnames
    ns.tprint('Mapping network');
    const hostnames = nmap(ns);
    putHostnames(ns, hostnames);

    // Erase old versions of files, then upload
    // the batchable files to every server
    ns.tprint('Wiping old scripts');
    for (const hostname of hostnames) {
        if (hostname !== 'home') {
            const scripts = ns.ls(hostname, '.js');
            for (const script of scripts) {
                ns.rm(script, hostname);
            }
        }
    }

    ns.tprint('Cataloging all local scripts');
    const scripts = ns.ls('home').filter(s=>s.endsWith('.js'));

    ns.tprint('Cataloging coding contracts');
    const contracts = hostnames.map((hostname) => {
        const ccts = ns.ls(hostname).filter(f=>f.endsWith('.cct'));
        return ccts.map((filename) => ({ filename, hostname }));
    }).flat();

    putStaticData(ns, { scripts, contracts });

    ns.tprint('Initializing money data');
    putMoneyData(ns, {
        income:0, income1s:0, income5s:0,
        income10s:10, income30s:0, income60s:0,
    });

    // Go to next step in the boot sequence
	defer(ns)(...ns.args);
}