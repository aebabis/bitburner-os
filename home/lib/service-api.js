import Ports from './ports';
import { PORT_SERVICES_LIST, PORT_SERVICES_REPL } from '../etc/ports';
import { table } from './table';

export const DISABLE = 'DISABLE';
export const ENABLE = 'ENABLE';

const getServiceName = (/** @type {string} */ script) =>
  script.split('/').pop()?.split('.').shift();

/** @typedef {{id: number | string, name: string, status: string, pid: number, desc: string}} ServiceData */
/** @param {NS} ns @param {ServiceData[]} taskData */
export const getTableString = (ns, taskData) => {
  return table(
    ns,
    ['ID', 'NAME', '', 'PID', 'DESC'],
    taskData.map(
      (
        /** @type {{id: number | string, name: string, status: string, pid: number, desc: string}} */ {
          id,
          name,
          status,
          pid,
          desc,
        },
      ) => [id, name, status, pid, desc],
    ),
  );
};

/** @param {NS} ns */
export const getServices = (ns) => {
  return Ports(ns).getPortHandle(PORT_SERVICES_LIST).peek();
};

/** @param {NS} ns */
export const disableService = async (
  ns,
  idOrName = getServiceName(ns.getScriptName()),
) => {
  await Ports(ns).getPortHandle(PORT_SERVICES_REPL).blockingWrite({
    identifier: idOrName,
    type: DISABLE,
  });
};

/** @param {NS} ns */
export const enableService = async (
  ns,
  /** @type {string | number} */ idOrName,
  override = false,
) => {
  await Ports(ns).getPortHandle(PORT_SERVICES_REPL).blockingWrite({
    identifier: idOrName,
    type: ENABLE,
    override,
  });
  // TODO: Await response?
};

/** @param {NS} ns */
export const writeServices = (ns, /** @type {ServiceData[]} */ services) => {
  const handle = Ports(ns).getPortHandle(PORT_SERVICES_LIST);
  handle.clear();
  handle.write(services);
};

/** @param {NS} ns */
export const checkQueue = (ns) => {
  const port = Ports(ns).getPortHandle(PORT_SERVICES_REPL);
  const tasks = [];
  while (!port.empty()) {
    tasks.push(port.read());
  }
  return tasks;
};
