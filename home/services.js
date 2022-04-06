import { getServices, enableService, disableService, getTableString } from './lib/planner-api.js';

/** @param {NS} ns */
export async function main(ns) {
    const { _, force } = ns.flags([['force', false]]);
    const [command, target] = _;
    if (command == null)
        ns.tprint('\n' + getTableString(ns, getServices(ns)));
    else if (command === 'enable')
        enableService(ns, target, force);
    else if (command === 'disable')
        disableService(ns, target);
    else if (command === 'restart') {
        // TODO
    } else if (command === 'stop') {
        // TODO
    }
}