import { PORT_SCH_DELEGATE_TASK, PORT_SCH_RETURN } from "../etc/ports";
import Ports from "./ports";
import { logger } from "./logger";

export const snippet = (/** @type {string} */ statements) =>
  `export async function main(ns) {\n${statements}\n}`;

const desc = (/** @type {string} */ script, host = null, /** @type {number} */ numThreads = 1, ...args) =>
  `${script} ${host || "*"} ${numThreads} ${args.join(" ")}`;

const Job =
  (/** @type {NS} */ ns, /** @type {boolean} */ response, /** @type {number} */ startTime, /** @type {boolean} */ highPriority) =>
  (/** @type {string} */ script, host = null, /** @type {number} */ numThreads = 1, ...args) => {
    if (script.startsWith(".") || !script.endsWith(".js"))
      throw new Error(
        `Illegal script name in ${desc(script, host, numThreads, ...args)}`,
      );
    if (!Number.isInteger(numThreads))
      throw new Error(
        `Illegal thread count in ${desc(script, host, numThreads, ...args)}`,
      );

    const ticket = response ? crypto.randomUUID() : undefined;
    return {
      script,
      host,
      numThreads,
      args,
      ticket,
      startTime,
      requestTime: Date.now(),
      highPriority,
    };
  };

/** @param {NS} ns **/
export const delegate =
  (ns, /** @type {boolean} */ response, /** @type {{startTime?: number, highPriority?: boolean}} */ options = {}) =>
  async (/** @type {string} */ script, host = null, /** @type {number} */ numThreads = 1, ...args) => {
    const { startTime = Date.now(), highPriority = false } = options;
    const job = Job(ns, response, startTime, highPriority)(
      script,
      host,
      numThreads,
      ...args,
    );
    const port = Ports(ns).getPortHandle(PORT_SCH_DELEGATE_TASK);
    await port.blockingWrite(job);
    if (response) {
      const start = Date.now();
      await ns.sleep(50);
      const port = Ports(ns).getPortHandle(PORT_SCH_RETURN);
      let prevProcess;
      while (true) {
        const process = port.peek();
        if (process != null) {
          if (process.ticket === job.ticket) return port.read();
          // If same process in port two consecutive
          // passes, assume parent died.
          if (process.pid === prevProcess?.pid) port.read();
        } else if (Date.now() - start >= 70000)
          // Unnecessary if all parents listen
          throw new Error(
            `Timed-out: ${script} ${host || "*"} ${numThreads} ${args.join(" ")}`,
          );
        await ns.sleep(10);
        prevProcess = process;
      }
    }
  };

/** @param {NS} ns **/
export const delegateAny =
  (ns, /** @type {boolean} */ response, /** @type {{startTime?: number, highPriority?: boolean}} */ options) =>
  async (/** @type {string} */ script, /** @type {number} */ numThreads = 1, ...args) =>
    await delegate(ns, response, options)(script, null, numThreads, ...args);

/** @param {NS} ns */
export const createBatch = (ns) => {
  let jobs = [];
  const delegate =
    (/** @type {number} */ startTime) =>
    (/** @type {string} */ script, host = null, /** @type {number} */ numThreads = 1, ...args) =>
      jobs.push(Job(ns, false, startTime)(script, host, numThreads, ...args));
  return {
    delegate,
    delegateAny:
      (/** @type {number} */ startTime) =>
      (/** @type {string} */ script, /** @type {number} */ numThreads = 1, ...args) =>
        delegate(startTime)(script, null, numThreads, ...args),
    getSize: () => jobs.length,
    send: async () =>
      Ports(ns).getPortHandle(PORT_SCH_DELEGATE_TASK).blockingWrite(jobs),
  };
};

/** @param {NS} ns **/
export const getDelegatedTasks = async (ns) => {
  const port = Ports(ns).getPortHandle(PORT_SCH_DELEGATE_TASK);
  const tasks = [];
  while (!port.empty()) {
    const messages = [port.read()].flat(Infinity);
    try {
      tasks.push(...messages);
    } catch (error) {
      await logger(ns).error(error); // TODO: Pretty
    }
  }
  return tasks;
};

/** @param {NS} ns **/
export const closeTicket = (ns) => async (ticket, /** @type {number} */ pid, /** @type {string} */ hostname, /** @type {number} */ threads) => {
  const port = Ports(ns).getPortHandle(PORT_SCH_RETURN);
  while (port.full()) {
    await ns.sleep(50);
  }

  const timestamp = Date.now();
  const waitTime = timestamp - ticket.startTime;
  if (waitTime > 40) logger(ns).warn("process delayed by " + waitTime + "ms");

  port.write({ ticket, pid, hostname, threads, timestamp });
};

/** @param {NS} ns **/
export async function main(ns) {
  const [script, ...args] = ns.args;
  delegateAny(ns)(script, 1, ...args);
}
