import { PORT_SCH_DELEGATE_TASK, PORT_SCH_RETURN } from '../etc/ports';
import Ports from './ports';
import { logger } from './logger';
import { getSchedulerReportData, putSchedulerReportData } from './data-store';

const desc = (
  /** @type {string} */ script,
  host = null,
  /** @type {number} */ numThreads = 1,
  /** @type {ScriptArg[]} */ ...args
) => `${script} ${host || '*'} ${numThreads} ${args.join(' ')}`;

const Job =
  (
    /** @type {NS} */ ns,
    /** @type {boolean} */ response,
    /** @type {number} */ startTime,
    /** @type {boolean} */ highPriority = false,
  ) =>
  (
    /** @type {string} */ script,
    host = null,
    /** @type {number} */ numThreads = 1,
    /** @type {ScriptArg[]} */ ...args
  ) => {
    if (script.startsWith('.') || !script.endsWith('.js'))
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
  (
    ns,
    /** @type {boolean} */ response,
    /** @type {{startTime?: number, highPriority?: boolean}} */ options = {},
  ) =>
  async (
    /** @type {string} */ script,
    host = null,
    /** @type {number} */ numThreads = 1,
    /** @type {ScriptArg[]} */ ...args
  ) => {
    const { startTime = Date.now(), highPriority = false } = options;
    const job = Job(ns, response, startTime, highPriority)(
      script,
      host,
      numThreads,
      ...args,
    );
    const port = Ports(ns).getPortHandle(PORT_SCH_DELEGATE_TASK);
    const written = await port.blockingWrite(job);
    if (!written) {
      const { enqueueFails = 0 } = getSchedulerReportData(ns);
      putSchedulerReportData(ns, { enqueueFails: enqueueFails + 1 });
      throw new Error(`Scheduler port full; could not enqueue: ${script}`);
    }
    if (response) {
      const start = Date.now();
      await ns.sleep(50);
      const port = Ports(ns).getPortHandle(PORT_SCH_RETURN);
      while (true) {
        const responses = port.peek();
        if (responses?.[job.ticket] != null) return responses[job.ticket];
        if (Date.now() - start >= 70000)
          throw new Error(
            `Timed-out: ${script} ${host || '*'} ${numThreads} ${args.join(' ')}`,
          );
        await ns.sleep(10);
      }
    }
  };

/** @param {NS} ns **/
export const delegateAny =
  (
    ns,
    /** @type {boolean} */ response = false,
    /** @type {{startTime?: number, highPriority?: boolean}} */ options = {},
  ) =>
  async (
    /** @type {string} */ script,
    numThreads = 1,
    /** @type {ScriptArg[]} */ ...args
  ) =>
    await delegate(ns, response, options)(script, null, numThreads, ...args);

/** @param {NS} ns */
export const createBatch = (ns) => {
  const jobs = /** @type {ReturnType<ReturnType<typeof Job>>[]} */ ([]);
  const delegate =
    (/** @type {number} */ startTime) =>
    (
      /** @type {string} */ script,
      host = null,
      /** @type {number} */ numThreads = 1,
      /** @type {ScriptArg[]} */ ...args
    ) =>
      jobs.push(
        Job(ns, false, startTime, false)(script, host, numThreads, ...args),
      );
  return {
    delegate,
    delegateAny:
      (/** @type {number} */ startTime) =>
      (
        /** @type {string} */ script,
        /** @type {number} */ numThreads = 1,
        /** @type {ScriptArg[]} */ ...args
      ) =>
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

const TICKET_TTL = 30_000;

/** @param {NS} ns **/
export const closeTicket =
  (ns) =>
  async (
    /** @type {string} */ ticket,
    /** @type {number} */ pid = 0,
    /** @type {string | null} */ hostname = null,
    /** @type {number} */ threads = 0,
  ) => {
    const port = Ports(ns).getPortHandle(PORT_SCH_RETURN);
    const timestamp = Date.now();
    const responses = port.peek() || {};
    for (const [k, v] of Object.entries(responses))
      if (timestamp - v.timestamp > TICKET_TTL) delete responses[k];
    responses[ticket] = { pid, hostname, threads, timestamp };
    port.clear();
    port.write(responses);
    return true;
  };
