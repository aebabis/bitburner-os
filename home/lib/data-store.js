import Ports from "./ports";
import {
  PORT_HOSTNAMES,
  PORT_STATIC_DATA,
  PORT_GANG_DATA,
  PORT_DASHBOARD_DATA,
  PORT_SCH_RAM_DATA,
  PORT_PLAYER_DATA,
  PORT_MONEY_DATA,
  PORT_CONTRACT_DATA,
  PORT_GOALS_DATA,
} from "../etc/ports";

/** @param {NS} ns @param {number} port */
const readData = (ns, port) => Ports(ns).getPortHandle(port).peek();

/** @param {NS} ns @param {number} portId */
const replaceData = (ns, portId, data) => {
  const port = Ports(ns).getPortHandle(portId);
  port.clear();
  port.write(data);
};

/** @param {NS} ns @param {number} portId */
const putData = (ns, portId, data) => {
  const oldData = readData(ns, portId) || {};
  const newData = Object.assign(oldData, data);
  const port = Ports(ns).getPortHandle(portId);
  port.clear();
  port.write(newData);
};

/** @param {NS} ns
 *  @returns {string[]} */
export const getHostnames = (ns) => readData(ns, PORT_HOSTNAMES);
/** @param {NS} ns
 *  @param {string[]} hostnames */
export const putHostnames = (ns, hostnames) =>
  replaceData(ns, PORT_HOSTNAMES, hostnames);

/** @param {NS} ns */
export const getStaticData = (ns) => readData(ns, PORT_STATIC_DATA) || {};
/** @param {NS} ns */
export const putStaticData = (ns, data) => putData(ns, PORT_STATIC_DATA, data);

/** @param {NS} ns */
export const getGangData = (ns) => readData(ns, PORT_GANG_DATA);
/** @param {NS} ns */
export const putGangData = (ns, data) => putData(ns, PORT_GANG_DATA, data);

/** @param {NS} ns */
export const getDataboardData = (ns) => readData(ns, PORT_DASHBOARD_DATA);
/** @param {NS} ns */
export const putDashboardData = (ns, data) =>
  putData(ns, PORT_DASHBOARD_DATA, data);

/** @param {NS} ns */
export const getRamData = (ns) => readData(ns, PORT_SCH_RAM_DATA);
/** @param {NS} ns */
export const putRamData = (ns, data) =>
  replaceData(ns, PORT_SCH_RAM_DATA, data);

/** @param {NS} ns */
export const getPlayerData = (ns) => readData(ns, PORT_PLAYER_DATA) || {};
/** @param {NS} ns */
export const putPlayerData = (ns, data) => putData(ns, PORT_PLAYER_DATA, data);

/** @param {NS} ns */
export const getMoneyData = (ns) => readData(ns, PORT_MONEY_DATA) || {};
/** @param {NS} ns */
export const putMoneyData = (ns, data) => putData(ns, PORT_MONEY_DATA, data);

/** @param {NS} ns */
export const getContractData = (ns) => readData(ns, PORT_CONTRACT_DATA) || {};
/** @param {NS} ns */
export const putContractData = (ns, data) =>
  putData(ns, PORT_CONTRACT_DATA, data);

/** @param {NS} ns */
export const getGoalsData = (ns) => readData(ns, PORT_GOALS_DATA) || {};
/** @param {NS} ns */
export const putGoalsData = (ns, data) => putData(ns, PORT_GOALS_DATA, data);

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
  if (command === "peek") {
    const [portname, ...props] = (/** @type {string} */ (data)).split(".");
    const portId = ports[/** @type {keyof typeof ports} */ (portname)];
    let content = Ports(ns).getPortHandle(portId).peek();
    for (const prop of props) content = content[prop];
    ns.tprint(JSON.stringify(content, null, 2));
  }
  if (command === "keys") {
    const portId = ports[/** @type {keyof typeof ports} */ (data)];
    let content = Ports(ns).getPortHandle(portId).peek();
    ns.tprint("\n" + Object.keys(content).join("\n"));
  }
}
