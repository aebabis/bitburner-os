import Ports from './ports';
import { PORT_SERVICES_LIST, PORT_SERVICES_REPL } from '../etc/ports';
import { table } from './table';

export const DISABLE = 'DISABLE';
export const ENABLE = 'ENABLE';

type ServiceData = {
  id: number | string;
  name: string;
  script: string;
  status: string;
  isRunning: boolean;
  allowed: boolean;
  pid: number | null;
  desc: string;
  ram: number;
};

const getServiceName = (script: string) => script.split('/').pop()?.split('.').shift();

export const getTableString = (ns: NS, taskData: ServiceData[]) => {
  return table(
    ns,
    ['ID', 'NAME', '', 'PID', 'DESC'],
    taskData.map(({ id, name, status, pid, desc }) => [id, name, status, pid || '', desc]),
  );
};

export const getServices = (ns: NS): ServiceData[] | null => {
  return Ports(ns).getPortHandle(PORT_SERVICES_LIST).peek();
};

export const disableService = async (ns: NS, idOrName = getServiceName(ns.getScriptName())) => {
  await Ports(ns).getPortHandle(PORT_SERVICES_REPL).blockingWrite({
    identifier: idOrName,
    type: DISABLE,
  });
};

export const enableService = async (ns: NS, idOrName: string | number, override = false) => {
  await Ports(ns).getPortHandle(PORT_SERVICES_REPL).blockingWrite({
    identifier: idOrName,
    type: ENABLE,
    override,
  });
  // TODO: Await response?
};

export const writeServices = (ns: NS, services: ServiceData[]) => {
  const handle = Ports(ns).getPortHandle(PORT_SERVICES_LIST);
  handle.clear();
  handle.write(services);
};

export const checkQueue = (ns: NS) => {
  const port = Ports(ns).getPortHandle(PORT_SERVICES_REPL);
  const tasks = [];
  while (!port.empty()) {
    tasks.push(port.read());
  }
  return tasks;
};
