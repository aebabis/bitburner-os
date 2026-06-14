import {
  putPlayerData,
  putRamData,
  putSchedulerReportData,
  getStaticData,
} from '../lib/data-store';
import { logger } from '../lib/logger';

import {
  ENABLE,
  DISABLE,
  writeServices,
  checkQueue,
  getTableString,
} from '../lib/service-api';
import { getViableServices } from './services/services';
import { getDelegatedTasks, closeTicket } from '../lib/scheduler-delegate';
import {
  execOnBestServer,
  getRootServers,
  getPurchasedServers,
} from '../lib/ram-router';
import { PORT_SCH_DELEGATE_TASK, PORT_SCH_RETURN } from '../etc/ports';

const player = (ns: NS) => ns.getPlayer();

const go = async (ns: NS) => {
  ns.disableLog('ALL');

  const { resetInfo } = getStaticData(ns);
  if (resetInfo.currentNode === 8) {
    ns.exec('/bin/self/buy-ram.ts', 'home');
  }

  const tasks = getViableServices(ns, player);

  const lastRuns: Record<string, number> = {};
  const lastCancellations: Record<string, number> = {};
  let droppedTickets = 0;

  const showServices = () => {
    ns.clearLog();
    const taskData = tasks.map((task) => task.toData());
    writeServices(ns, taskData);
    ns.print(getTableString(ns, taskData));
  };

  const updateTasks = () => {
    for (const order of checkQueue(ns)) {
      const { identifier, type, force } = order;
      const task = tasks.find((task) => task.matches(identifier));
      if (task == null) throw new Error(`No task matching "${identifier}"`);
      if (type === ENABLE) task.enable(force);
      if (type === DISABLE) task.disable();
    }
  };

  const handleExecRequests = async () => {
    const delegated = await getDelegatedTasks(ns);
    for (const taskData of delegated) {
      const { script, host, numThreads, args, ticket, highPriority } = taskData;
      if (ns.getScriptRam(script, 'home') === 0) {
        logger(ns).error(`No such script: ${script}`);
        if (ticket != null && !(await closeTicket(ns)(ticket)))
          droppedTickets++;
        continue;
      }
      const result = execOnBestServer(
        ns,
        script,
        host ?? null,
        numThreads,
        !!highPriority,
        args,
      );
      if (result.pid === 0) {
        lastCancellations[script] = Date.now();
        droppedTickets++;
        if (ticket != null) await closeTicket(ns)(ticket, 0, null, 0);
      } else {
        lastRuns[script] = Date.now();
        if (ticket != null)
          await closeTicket(ns)(
            ticket,
            result.pid,
            result.hostname,
            result.threads,
          );
      }
    }
  };

  const updateReports = () => {
    putRamData(ns, {
      rootServers: getRootServers(ns) as any,
      purchasedServers: getPurchasedServers(ns) as any,
    });
    putSchedulerReportData(ns, {
      lastRuns,
      lastCancellations,
      heartbeat: Date.now(),
      droppedTickets,
      maxWaitTime: 0,
      enqueueFails: 0,
      inputFull: ns.getPortHandle(PORT_SCH_DELEGATE_TASK).full(),
      outputFull: ns.getPortHandle(PORT_SCH_RETURN).full(),
    });
  };

  while (true) {
    await handleExecRequests();
    putPlayerData(ns, { player: player(ns) });
    for (const task of tasks) {
      try {
        updateTasks();
        showServices();
        await task.check(showServices);
      } catch (error) {
        console.error(error);
        if (error?.name === 'ScriptDeath') throw error;
        await logger(ns).error(error);
      }
    }

    showServices();
    updateReports();

    await ns.sleep(1000);
  }
};

export async function main(ns: NS) {
  try {
    await go(ns);
  } catch (error) {
    if (error?.name === 'ScriptDeath') throw error;
    await logger(ns).error(error);
  }
}
