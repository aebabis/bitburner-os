import getConfig from '/lib/config';
import { table } from '/lib/table';
import { by } from '/lib/util';

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');

    const [prop, value] = ns.args;
    const config = getConfig(ns);

    if (prop == null)
        ns.tprint('\n'+table(ns, ['NAME', 'DESC', 'VALUE'],
            config.getRows()
                .sort(by('name'))
                .map(({name, desc, value})=>[name, desc, value])));
    else if (value == null)
        ns.tprint(config.get(prop));
    else
        ns.tprint(config.set(prop, value));
}
