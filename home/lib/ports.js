const NULL = "NULL PORT DATA";

const s = (data) => {
  if (data === null)
    throw new Error('Cannot write null. This interface uses null for "empty"');
  return JSON.stringify({ data });
};
/** @param {string} packet */
const p = (packet) => JSON.parse(packet).data;

/** @param {NS} ns **/
export default (ns) => {
  const readPort = (/** @type {number} */ handle) => {
    const packet = ns.getPortHandle(handle).read();
    if (packet === NULL) return null;
    return p(packet);
  };
  const writePort = (/** @type {number} */ handle, data) => ns.getPortHandle(handle).write(s(data));
  const tryWritePort = (/** @type {number} */ handle, data) =>
    ns.getPortHandle(handle).tryWrite(s(data));
  const blockingWritePort = async (/** @type {number} */ handle, data, timeout = 60000) => {
    let start = Date.now();
    let outcome = false;
    while (true) {
      outcome = ns.getPortHandle(handle).tryWrite(s(data));
      if (!outcome && Date.now() - start <= timeout) await ns.sleep(50);
      else break;
    }
    return outcome;
  };
  const clearPort = (/** @type {number} */ handle) => ns.getPortHandle(handle).clear();

  const peek = (/** @type {number} */ handle) => {
    const packet = ns.getPortHandle(handle).peek();
    if (packet === NULL) return null;
    return p(packet);
  };
  const full = (/** @type {number} */ handle) => ns.getPortHandle(handle).full();
  const empty = (/** @type {number} */ handle) => ns.getPortHandle(handle).empty();

  return {
    readPort,
    writePort,
    tryWritePort,
    blockingWritePort,
    clearPort,
    getPortHandle: (/** @type {number} */ handle) => ({
      read: () => readPort(handle),
      write: (data) => writePort(handle, data),
      tryWrite: (data) => tryWritePort(handle, data),
      blockingWrite: (data, /** @type {number} */ timeout = 60000) =>
        blockingWritePort(handle, data, timeout),
      clear: () => clearPort(handle),
      peek: () => peek(handle),
      full: () => full(handle),
      empty: () => empty(handle),
    }),
  };
};
