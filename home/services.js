import {
  getServices,
  enableService,
  disableService,
  // restartService,
  getTableString,
} from "./lib/service-api.js";

/** @typedef {{id: number | string, name: string, status: string, pid: number, desc: string}} ServiceEntry */

/** @param {NS} ns */
export async function main(ns) {
  const flags = ns.flags([["force", false]]);
  const [command, target] = /** @type {string[]} */ (flags._);
  const force = /** @type {boolean} */ (flags.force);
  if (command == null) ns.tprint("\n" + getTableString(ns, getServices(ns)));
  else if (command === "enable") enableService(ns, target, force);
  else if (command === "disable") disableService(ns, target);
  // else if (command === 'restart')
  //   restartService(ns, target);
  else if (command === "start") enableService(ns, target, force);
  else if (command === "stop") disableService(ns, target);
  else if (command === "tail") {
    const services = /** @type {ServiceEntry[]} */ (getServices(ns));
    const service = services.find(
      (service) => service.id === target || service.name === target,
    );
    if (service != null) ns.ui.openTail(service.pid);
    else {
      ns.tprint(`Service not found with descriptor "${target}"`);
      ns.tprint(
        `Available services: ${services.map((s) => s.name).join(", ")}`,
      );
    }
  }
}
