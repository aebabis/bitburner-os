import getConfig from './lib/config';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const [prop, value] = ns.args;
    const config = getConfig(ns);

    if (value == null)
        ns.tprint(config.get(prop));
    else
        ns.tprint(config.set(prop, value));
}
