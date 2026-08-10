const NULL = 'NULL PORT DATA';

const assertWritable = (data: unknown) => {
  if (data === null) throw new Error('Cannot write null. This interface uses null for "empty"');
  return data;
};

export default (ns: NS) => {
  const readPort = (handle: number) => {
    const data = ns.getPortHandle(handle).read();
    if (data === NULL) return null;
    return data;
  };
  const writePort = (handle: number, data: unknown) =>
    ns.getPortHandle(handle).write(assertWritable(data));
  const tryWritePort = (handle: number, data: unknown) =>
    ns.getPortHandle(handle).tryWrite(assertWritable(data));
  const blockingWritePort = async (handle: number, data: unknown, timeout = 60000) => {
    let start = Date.now();
    let outcome = false;
    while (true) {
      outcome = ns.getPortHandle(handle).tryWrite(assertWritable(data));
      if (!outcome && Date.now() - start <= timeout) await ns.sleep(50);
      else break;
    }
    return outcome;
  };
  const clearPort = (handle: number) => ns.getPortHandle(handle).clear();

  const peek = (handle: number) => {
    const data = ns.getPortHandle(handle).peek();
    if (data === NULL) return null;
    return data;
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
