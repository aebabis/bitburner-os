import { PORT_SCH_DELEGATE_TASK, PORT_SCH_RETURN } from '../etc/ports';
import Ports from './ports';
import { getSchedulerReportData, putSchedulerReportData } from './data-store';

const desc = (script: string, host = null, numThreads = 1, ...args: ScriptArg[]) =>
  `${script} ${host || '*'} ${numThreads} ${args.join(' ')}`;

const Job =
  (response: boolean, startTime: number, highPriority = false) =>
  (script: string, host = null, numThreads = 1, ...args: ScriptArg[]) => {
    if (script.startsWith('.') || !script.endsWith('.ts'))
      throw new Error(`Illegal script name in ${desc(script, host, numThreads, ...args)}`);
    if (!Number.isInteger(numThreads))
      throw new Error(`Illegal thread count in ${desc(script, host, numThreads, ...args)}`);

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

type DelegateOptions = {
  startTime?: number;
  highPriority?: boolean;
};

const delegate =
  (ns: NS, response: boolean, options: DelegateOptions = {}) =>
  async (script: string, host = null, numThreads = 1, ...args: ScriptArg[]) => {
    const { startTime = Date.now(), highPriority = false } = options;
    const job = Job(response, startTime, highPriority)(script, host, numThreads, ...args);
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
        if (job.ticket != null && responses?.[job.ticket] != null) return responses[job.ticket];
        if (Date.now() - start >= 70000)
          throw new Error(`Timed-out: ${script} ${host || '*'} ${numThreads} ${args.join(' ')}`);
        await ns.sleep(10);
      }
    }
  };

export const delegateAny =
  (ns: NS, response = false, options: DelegateOptions = {}) =>
  async (script: string, numThreads = 1, ...args: ScriptArg[]) =>
    await delegate(ns, response, options)(script, null, numThreads, ...args);

export const getDelegatedTasks = async (ns: NS) => {
  const port = Ports(ns).getPortHandle(PORT_SCH_DELEGATE_TASK);
  const tasks = [];
  while (!port.empty()) {
    const messages = [port.read()].flat(Infinity);
    try {
      tasks.push(...messages);
    } catch (error) {
      console.error(error);
    }
  }
  return tasks;
};

const TICKET_TTL = 30_000;

type Resolution = {
  pid: number;
  hostname: string | null;
  threads: number;
  timestamp: number;
};

export const closeTicket =
  (ns: NS) =>
  async (ticket: string, pid = 0, hostname: string | null = null, threads = 0) => {
    const port = Ports(ns).getPortHandle(PORT_SCH_RETURN);
    const timestamp = Date.now();
    const responses: Record<string, Resolution> = port.peek() || {};
    for (const [k, v] of Object.entries(responses))
      if (timestamp - v.timestamp > TICKET_TTL) delete responses[k];
    responses[ticket] = { pid, hostname, threads, timestamp };
    port.clear();
    port.write(responses);
    return true;
  };
