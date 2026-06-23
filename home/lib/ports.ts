const NULL = 'NULL PORT DATA';

function replacer(_key: string, value: unknown) {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else if (value === Infinity) {
    return {
      dataType: 'number',
      value: 'Infinity',
    };
  } else {
    return value;
  }
}

function reviver(_key: string, value: unknown) {
  if (typeof value === 'object' && value !== null) {
    if ('dataType' in value) {
      if (value.dataType === 'Map' && 'value' in value) {
        return new Map(value.value as [string, unknown][]);
      }
      if (value.dataType === 'number' && 'value' in value && value.value === 'Infinity') {
        return Infinity;
      }
    }
  }
  return value;
}

const s = (data: unknown) => {
  if (data === null) throw new Error('Cannot write null. This interface uses null for "empty"');
  return JSON.stringify({ data }, replacer);
};
const p = (packet: string) => JSON.parse(packet, reviver).data;

export default (ns: NS) => {
  const readPort = (handle: number) => {
    const packet = ns.getPortHandle(handle).read();
    if (packet === NULL) return null;
    return p(packet);
  };
  const writePort = (handle: number, data: unknown) => ns.getPortHandle(handle).write(s(data));
  const tryWritePort = (handle: number, data: unknown) =>
    ns.getPortHandle(handle).tryWrite(s(data));
  const blockingWritePort = async (handle: number, data: unknown, timeout = 60000) => {
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
      write: (data: unknown) => writePort(handle, data),
      tryWrite: (data: unknown) => tryWritePort(handle, data),
      blockingWrite: (data: unknown, timeout = 60000) => blockingWritePort(handle, data, timeout),
      clear: () => clearPort(handle),
      peek: () => peek(handle),
      full: () => full(handle),
      empty: () => empty(handle),
    }),
  };
};
