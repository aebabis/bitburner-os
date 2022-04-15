import { PORT_RUN_CONFIG } from './etc/ports';
import Ports from './lib/ports';

const PROPS = {
    share: ['Share Rate', 0, (x) => x >= 0 && x <= 1],
    "share-cap": ['Max Share Threads', 1<<20, (x) => x >= 0],
    "reserved-funds": ['Threshold for Investment', 1e10, (x) => x >= 0],
};

export default (ns) => {
    const port = Ports(ns).getPortHandle(PORT_RUN_CONFIG);

    const getProps = () => {
        let obj = port.peek();
        if (obj == null || typeof obj !== 'object') {
            obj = {};
            port.clear();
            port.write(obj);
        }
        return obj;
    }

    return {
        init: (obj) => {
            port.clear();
            port.write(obj);
        },
        get: (prop) => {
            const props = getProps();
            if (props[prop] === undefined)
                props[prop] = PROPS[prop][1];
            return props[prop];
        },
        set: (prop, value) => {
            if (PROPS[prop] == null)
                throw new Error(`Unrecognized prop "${prop}"`);
            if (!PROPS[prop][2](value))
                throw new Error(`Illegal value for "${prop}": "${value}"`);
            const obj = getProps();
            obj[prop] = value;
            port.clear();
            port.write(obj);
            return `Set ${PROPS[prop][0]} to ${value}`;
        },
        getAll: () => getProps(),
    }
}
