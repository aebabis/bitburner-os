import { putPlayerData } from '../lib/data-store';
import { logger } from '../lib/logger';

import {
  ENABLE,
  DISABLE,
  writeServices,
  checkQueue,
  getTableString,
} from '../lib/service-api';
import { getViableServices } from './services/services';

/** @param {NS} ns **/
const player = (ns) => ns.getPlayer(); // Makes it easier to audit getPlayer use

/** @param {NS} ns **/
const go = async (ns) => {
  ns.disableLog('ALL');

  const tasks = getViableServices(ns, player);

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

  while (true) {
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

    await ns.sleep(1000);
  }
};

/** @param {NS} ns **/
export async function main(ns) {
  try {
    await go(ns);
  } catch (error) {
    if (error?.name === 'ScriptDeath') throw error;
    await logger(ns).error(error);
  }
}
