const NULL = 'NULL PORT DATA';

function replacer(key, value) {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}

function reviver(key, value) {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}

const s = (data) => {
  if (data === null)
    throw new Error('Cannot write null. This interface uses null for "empty"');
  return JSON.stringify({ data }, replacer);
};
const p = (packet: string) => JSON.parse(packet, reviver).data;

export default (ns: NS) => {
  const readPort = (handle: number) => {
    const packet = ns.getPortHandle(handle).read();
    if (packet === NULL) return null;
    return p(packet);
  };
  const writePort = (handle: number, data) =>
    ns.getPortHandle(handle).write(s(data));
  const tryWritePort = (handle: number, data) =>
    ns.getPortHandle(handle).tryWrite(s(data));
  const blockingWritePort = async (handle: number, data, timeout = 60000) => {
    let start = Date.now();
    let outcome = false;
    while (true) {
      outcome = ns.getPortHandle(handle).tryWrite(s(data));
      if (!outcome && Date.now() - start <= timeout) await ns.sleep(50);
      else break;
    }
    return outcome;
  };
  const clearPort = (handle: number) => ns.getPortHandle(handle).clear();

  const peek = (handle: number) => {
    const packet = ns.getPortHandle(handle).peek();
    if (packet === NULL) return null;
    return p(packet);
  };
  const full = (handle: number) => ns.getPortHandle(handle).full();
  const empty = (handle: number) => ns.getPortHandle(handle).empty();

  return {
    readPort,
    writePort,
    tryWritePort,
    blockingWritePort,
    clearPort,
    getPortHandle: (handle: number) => ({
      read: () => readPort(handle),
      write: (data) => writePort(handle, data),
      tryWrite: (data) => tryWritePort(handle, data),
      blockingWrite: (data, timeout = 60000) =>
        blockingWritePort(handle, data, timeout),
      clear: () => clearPort(handle),
      peek: () => peek(handle),
      full: () => full(handle),
      empty: () => empty(handle),
    }),
  };
};
