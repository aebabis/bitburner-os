import { PORT_RUN_CONFIG } from './etc/ports';
import Ports from './lib/ports';

const PROPS = {
    share: ['Share Rate', (x) => x >= 0 && x <= 1],
}

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
        get: (prop) => getProps()[prop],
        set: (prop, value) => {
            if (PROPS[prop] == null)
                throw new Error(`Unrecognized prop "${prop}"`);
            if (!PROPS[prop][1](value))
                throw new Error(`Illegal value for "${prop}": "${value}"`);
            const obj = getProps();
            obj[prop] = value;
            port.clear();
            port.write(obj);
            return `Set ${PROPS[prop][0]} to ${value}`;
        },
    }
}
