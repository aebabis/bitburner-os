import { PORT_THIEVES_TO_RL } from './etc/ports';
import Ports from './lib/ports';

/** {NS} ns */
export const report = (ns, hostname, hasEnough) => {
    const port = Ports(ns).getPortHandle(PORT_THIEVES_TO_RL);
    const reports = port.peek() || {};
    reports[hostname] = hasEnough;
    port.clear();
    port.write(reports);
}

/** {NS} ns */
export const getReports = (ns) => Ports(ns).getPortHandle(PORT_THIEVES_TO_RL).peek();