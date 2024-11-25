import Ports from '/lib/ports';
import {
    PORT_HOSTNAMES,
    PORT_STATIC_DATA,
    PORT_GANG_DATA,
    PORT_DASHBOARD_DATA,
    PORT_SCH_RAM_DATA,
    PORT_PLAYER_DATA,
    PORT_MONEY_DATA,
} from '/etc/ports';

/** @param {NS} ns **/
const readData = (ns, port) => Ports(ns).getPortHandle(port).peek();

/** @param {NS} ns **/
const replaceData = (ns, portId, data) => {
    const port = Ports(ns).getPortHandle(portId);
    port.clear();
    port.write(data);
};

/** @param {NS} ns **/
const putData = (ns, portId, data) => {
    const oldData = readData(ns, portId) || {};
    const newData = Object.assign(oldData, data);
    const port = Ports(ns).getPortHandle(portId);
    port.clear();
    port.write(newData);
};

export const getHostnames = (ns) => readData(ns, PORT_HOSTNAMES);
export const putHostnames = (ns, hostnames) => replaceData(ns, PORT_HOSTNAMES, hostnames);

export const getStaticData = (ns) => readData(ns, PORT_STATIC_DATA) || {};
export const putStaticData = (ns, data) => putData(ns, PORT_STATIC_DATA, data);

export const getGangData = (ns) => readData(ns, PORT_GANG_DATA);
export const putGangData = (ns, data) => putData(ns, PORT_GANG_DATA, data);

export const getDataboardData = (ns) => readData(ns, PORT_DASHBOARD_DATA);
export const putDashboardData = (ns, data) => putData(ns, PORT_DASHBOARD_DATA, data);

export const getRamData = (ns) => readData(ns, PORT_SCH_RAM_DATA);
export const putRamData = (ns, data) => replaceData(ns, PORT_SCH_RAM_DATA, data);

export const getPlayerData = (ns) => readData(ns, PORT_PLAYER_DATA) || {};
export const putPlayerData = (ns, data) => putData(ns, PORT_PLAYER_DATA, data);

export const getMoneyData = (ns) => readData(ns, PORT_MONEY_DATA) || {};
export const putMoneyData = (ns, data) => putData(ns, PORT_MONEY_DATA, data);

/** @param {NS} ns **/
export async function main(ns) {
    const ports = {
        hostnames: PORT_HOSTNAMES,
        static: PORT_STATIC_DATA,
        gang: PORT_GANG_DATA,
        dashboard: PORT_DASHBOARD_DATA,
        scheduler: PORT_SCH_RAM_DATA,
        player: PORT_PLAYER_DATA,
        money: PORT_MONEY_DATA,
    };
    const [command, data] = ns.args;
    if (command === 'peek') {
        const [portname, ...props] = data.split('.');
        const portId = ports[portname];
        let content = Ports(ns).getPortHandle(portId).peek();
        for (const prop of props)
            content = content[prop];
        ns.tprint(JSON.stringify(content, null, 2));
    }
    if (command === 'keys') {
        const portId = ports[data];
        let content = Ports(ns).getPortHandle(portId).peek();
        ns.tprint('\n' + Object.keys(content).join('\n'));
    }
}
