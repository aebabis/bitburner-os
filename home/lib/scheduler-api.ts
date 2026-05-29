import { logger } from './logger';
import { getDelegatedTasks, closeTicket } from './scheduler-delegate';
import { HACK, GROW, WEAKEN, SHARE } from '../etc/filenames';
import { ERROR } from './colors';
const WORKERS = [HACK, GROW, WEAKEN, SHARE];

const TicketItem = (
  /** @type {{script: string, host: string | null, numThreads: number, args: string[], ticket?: string, startTime?: number, highPriority?: boolean}} */ {
    script,
    host,
    numThreads,
    args,
    ...rest
  },
) => {
  const time = rest.startTime || Date.now();
  const waitTime = () => Date.now() - time;
  const wait = () => (waitTime() / 1000).toFixed(3);
  const isWorker = WORKERS.includes(script);
  return {
    ...rest,
    script,
    host,
    numThreads,
    args,
    time,
    waitTime,
    isWorker,
    toString: (/** @type {string | undefined} */ hostname = undefined) =>
      `${script} ${hostname || host} ${numThreads} ${args.join(' ')} (${wait()}s)`,
  };
};

type TicketEntry = ReturnType<typeof TicketItem>;

export const checkPort = async (ns: NS, queue: TicketEntry[]) => {
  const delegated = await getDelegatedTasks(ns);
  for (const taskData of delegated) {
    const { script, ticket } = taskData;
    if (ns.getScriptRam(script, 'home') === 0) {
      logger(ns).error(
        `Scheduler received task for non-existant script: ${script}`,
      );
      if ((await closeTicket(ns)(ticket)) === false) droppedTickets++;
    } else queue.push(TicketItem(taskData));
  }
};

/** @type {Record<string, number>} */
export const lastRuns = {};
/** @type {Record<string, number>} */
export const lastCancellations = {};
export let droppedTickets = 0;

/** @param {NS} ns @param {TicketEntry} process @param {{hostname: string, ramAvailableTo: (process: TicketEntry) => number}} server **/
export const fulfill = async (ns, process, server) => {
  const { hostname, ramAvailableTo } = server;
  const { script, numThreads, args, ticket } = process;
  const scriptRam = ns.getScriptRam(script, 'home');
  const maxThreads = Math.floor(ramAvailableTo(process) / scriptRam);
  const threads = Math.min(numThreads, maxThreads);
  if (threads === 0) {
    if (process.isWorker) globalThis.__profiler?.recordReaped?.(args[1]);
    return reject(
      ns,
      process,
      'Scheduler tried to run: ' + process.toString() + ' on ' + hostname,
    );
  }
  const pid = ns.exec(script, hostname, threads, ...args);
  if (pid === 0) {
    if (process.isWorker) globalThis.__profiler?.recordReaped?.(args[1]);
    return reject(
      ns,
      process,
      'Unable to start process: ' + process.toString(hostname),
    );
  }
  lastRuns[script] = Date.now();
  if (
    ticket != null &&
    (await closeTicket(ns)(ticket, pid, hostname, threads)) === false
  )
    droppedTickets++;
};

/** @param {NS} ns @param {TicketEntry} process **/
export const reject = async (
  ns,
  process,
  /** @type {string | undefined} */ reason = undefined,
) => {
  lastCancellations[process.script] = Date.now();
  if (reason != null) ns.tprint(ERROR + reason);
  if (
    process.ticket != null &&
    (await closeTicket(ns)(process.ticket, 0, null, 0)) === false
  )
    droppedTickets++;
};
