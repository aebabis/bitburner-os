import { PORT_RUN_CONFIG } from "../etc/ports";
import Ports from "./ports";

const PROPS = /** @type {Record<string, string>} */({
  share: "Share rate",
  "share-cap": "Max share threads",
  "reserved-funds": "Threshold for investment",
  "reserved-home-ram": "On-demand RAM",
});

const VALIDATORS = /** @type {Record<string, (x: number) => boolean>} */({
  share: (/** @type {number} */ x) => x >= 0 && x <= 1,
  "share-cap": (/** @type {number} */ x) => x >= 0,
  "reserved-funds": (/** @type {number} */ x) => x >= 0,
  "reserved-home-ram": (/** @type {number} */ x) => x > 0 && x <= 1 << 20,
});

const DEFAULT_VALUES = {
  share: 0,
  "share-cap": 1 << 20,
  "reserved-funds": 1e10,
  "reserved-home-ram": 8,
};

/** @param {NS} ns **/
export const getConfig = (ns) => {
  const port = Ports(ns).getPortHandle(PORT_RUN_CONFIG);

  const getAll = () => {
    let obj = port.peek();
    if (typeof obj === "object") return obj;
    return {};
  };

  const writeConfig = (obj) => {
    port.clear();
    port.write(obj);
  };

  const get = (/** @type {string} */ prop) => getAll()[prop];

  const set = (/** @type {string} */ prop, /** @type {number} */ value) => {
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
      const desc = PROPS[name];
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

export default getConfig;
