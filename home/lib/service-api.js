import Ports from '/lib/ports';
import { PORT_SERVICES_LIST, PORT_SERVICES_REPL } from '/etc/ports';
import { table } from '/lib/table';

export const DISABLE = 'DISABLE';
export const ENABLE = 'ENABLE';

const getServiceName = (script) => script.split('/').pop().split('.').shift();

export const getTableString = (ns, taskData) => {
    return table(ns, ['ID', 'NAME', '', 'PID', 'DESC'], taskData.map(
        ({ id, name, status, pid, desc }) => [id, name, status, pid, desc]));
};

export const getServices = (ns) => {
    return Ports(ns).getPortHandle(PORT_SERVICES_LIST).peek();
};

export const disableService = async(ns, idOrName=getServiceName(ns.getScriptName())) => {
    await Ports(ns).getPortHandle(PORT_SERVICES_REPL).blockingWrite({
        identifier: idOrName, type: DISABLE,
    });
};

export const enableService = async(ns, idOrName, override=false) => {
    await Ports(ns).getPortHandle(PORT_SERVICES_REPL).blockingWrite({
        identifier: idOrName, type: ENABLE, override,
    });
    // TODO: Await response?
};

export const writeServices = (ns, services) => {
    const handle = Ports(ns).getPortHandle(PORT_SERVICES_LIST);
    handle.clear();
    handle.write(services);
};

export const checkQueue = (ns) => {
	const port = Ports(ns).getPortHandle(PORT_SERVICES_REPL);
    const tasks = [];
	while (!port.empty()) {
        tasks.push(port.read());
	}
    return tasks;
};
