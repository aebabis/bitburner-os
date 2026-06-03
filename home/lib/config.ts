import { PORT_RUN_CONFIG } from '../etc/ports';
import Ports from './ports';

const PROPS = {
  share: 'Share rate',
  'share-cap': 'Max share threads',
  'reserved-funds': 'Threshold for investment',
  'reserved-home-ram': 'On-demand RAM',
};

const VALIDATORS = {
  share: (x: number) => x >= 0 && x <= 1,
  'share-cap': (x: number) => x >= 0,
  'reserved-funds': (x: number) => x >= 0,
  'reserved-home-ram': (x: number) => x > 0 && x <= 1 << 20,
};

const DEFAULT_VALUES = {
  share: 0,
  'share-cap': 1 << 20,
  'reserved-funds': 1e10,
  'reserved-home-ram': 8,
};

export const getConfig = (ns: NS) => {
  const port = Ports(ns).getPortHandle(PORT_RUN_CONFIG);

  const getAll = () => {
    let obj = port.peek();
    if (typeof obj === 'object') return obj;
    return {};
  };

  const writeConfig = (obj: Record<string, number>) => {
    port.clear();
    port.write(obj);
  };

  const get = (prop: keyof typeof PROPS) => getAll()[prop];

  const set = (prop: keyof typeof PROPS, value: number) => {
    if (PROPS[prop] == null) throw new Error(`Unrecognized prop "${prop}"`);
    if (!VALIDATORS[prop](value))
      throw new Error(`Illegal value for "${prop}": "${value}"`);
    const obj = getAll();
    obj[prop] = value;
    writeConfig(obj);
    return `Set ${PROPS[prop]} to ${value}`;
  };

  const getRows = () => {
    const data = getAll();
    return Object.entries(data).map(([name, value]) => {
      const desc = PROPS[name as keyof typeof PROPS];
      return { name, value, desc };
    });
  };

  writeConfig(Object.assign({}, DEFAULT_VALUES, getAll()));

  return {
    get,
    set,
    getAll,
    getRows,
  };
};
