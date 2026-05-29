import Ports from './ports.ts';
import {
  PORT_HOSTNAMES,
  PORT_STATIC_DATA,
  PORT_GANG_DATA,
  PORT_SCH_RAM_DATA,
  PORT_SCH_REPORTING,
  PORT_PLAYER_DATA,
  PORT_MONEY_DATA,
  PORT_CONTRACT_DATA,
  PORT_CORP_REPORTS,
} from '../etc/ports.ts';

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
export const getSchedulerReportData = (ns) =>
  readData(ns, PORT_SCH_REPORTING) || {};
/** @param {NS} ns */
export const putSchedulerReportData = (ns, data) =>
  putData(ns, PORT_SCH_REPORTING, data);

/** @param {NS} ns */
export const getStaticData = (ns) => readData(ns, PORT_STATIC_DATA) || {};
/** @param {NS} ns */
export const putStaticData = (ns, data) => putData(ns, PORT_STATIC_DATA, data);

/** @param {NS} ns */
export const getGangData = (ns) => readData(ns, PORT_GANG_DATA);
/** @param {NS} ns */
export const putGangData = (ns, data) => putData(ns, PORT_GANG_DATA, data);

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
export const getCorpReports = (ns) => readData(ns, PORT_CORP_REPORTS) || {};
/** @param {NS} ns */
export const putCorpReports = (ns, data) =>
  putData(ns, PORT_CORP_REPORTS, data);
