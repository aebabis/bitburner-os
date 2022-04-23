import Ports from './lib/ports';
import { PORT_HOSTNAMES, PORT_STATIC_DATA, PORT_GANG_DATA } from './etc/ports';

/** @param {NS} ns **/
export const getHostnames = (ns) => {
    return Ports(ns).getPortHandle(PORT_HOSTNAMES).peek();
};

/** @param {NS} ns **/
export const putHostnames = (ns, hostnames) => {
    const port = Ports(ns).getPortHandle(PORT_HOSTNAMES);
    port.clear();
    port.write(hostnames);
};

export const getStaticData = (ns) => {
    return Ports(ns).getPortHandle(PORT_STATIC_DATA).peek() || {};
}

export const putStaticData = (ns, data) => {
    const newData = Object.assign(getStaticData(ns), data);
    const port = Ports(ns).getPortHandle(PORT_STATIC_DATA);
    port.clear();
    port.write(newData);
}

export const getGangData = (ns) => {
    return Ports(ns).getPortHandle(PORT_GANG_DATA).peek();
}

export const putGangData = (ns, data) => {
    const oldData = getGangData(ns) || {};
    const newData = Object.assign(oldData, data);
    const port = Ports(ns).getPortHandle(PORT_STATIC_DATA);
    port.clear();
    port.write(newData);
}