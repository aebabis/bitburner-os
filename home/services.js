import { getServices, enableService, disableService } from './lib/planner-api.js';

/** @param {NS} ns */
export async function main(ns) {
    const { _, force } = ns.flags([['force', false]]);
    const [command, target] = _;
    if (command == null)
        ns.tprint('\n' + getServices(ns).join('\n'));
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