const NULL = 'NULL PORT DATA';

const s = data => {
    if (data === null)
        throw new Error('Cannot write null. This interface uses null for "empty"');
    return JSON.stringify({data});
}
const p = packet => JSON.parse(packet).data;


/** @param {NS} ns **/
export default (ns) => {
    const readPort = (handle) => {
        const packet = ns.getPortHandle(handle).read();
        if (packet === NULL)
            return null;
        return p(packet);
    }
    const writePort = (handle, data) => ns.getPortHandle(handle).write(s(data));
    const tryWritePort = (handle, data) => ns.getPortHandle(handle).tryWrite(s(data));
    const blockingWritePort = async (handle, data, timeout=60000) => {
        let start = Date.now();
        let outcome = false;
        while (true) {
            outcome = ns.getPortHandle(handle).tryWrite(s(data));
            if (!outcome && Date.now() - start <= timeout)
                await ns.sleep(50);
            else break;
        }
        return outcome;
    };
    const clearPort = (handle) => ns.getPortHandle(handle).clear();

    const peek = (handle) => {
        const packet = ns.getPortHandle(handle).peek();
        if (packet === NULL)
            return null;
        return p(packet);
    }
    const full = (handle) => ns.getPortHandle(handle).full();
    const empty = (handle) => ns.getPortHandle(handle).empty();

    return {
        readPort,
        writePort,
        tryWritePort,
        blockingWritePort,
        clearPort,
        getPortHandle: (handle) => ({
            read: () => readPort(handle),
            write: (data) => writePort(handle, data),
            tryWrite: (data) => tryWritePort(handle, data),
            blockingWrite: (data, timeout) => blockingWritePort(handle, data, timeout),
            clear: () => clearPort(handle),
            peek: () => peek(handle),
            full: () => full(handle),
            empty: () => empty(handle),
        }),
    };
}