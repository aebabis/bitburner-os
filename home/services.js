import {
  getServices,
  enableService,
  disableService,
  restartService,
  getTableString
} from './lib/service-api.js';

/** @param {NS} ns */
export async function main(ns) {
  const { _, force } = ns.flags([['force', false]]);
  const [command, target] = _;
  if (command == null)
    ns.tprint('\n' + getTableString(ns, getServices(ns)));
  else if (command === 'enable')
    enableService(ns, target, force);
  else if (command === 'disable')
    disableService(ns, target);
  else if (command === 'restart')
    restartService(ns, target);
  else if (command === 'start')
    enableService(ns, target, force);
  else if (command === 'stop')
    disableService(ns, target);
  else if (command === 'tail') {
    const services = getServices(ns);
    const service = services
      .find(service => service.id === target || service.name === target);
    if (service != null)
      ns.tail(service.pid);
    else {
      ns.tprint(`Service not found with descriptor "${target}"`);
      ns.tprint(`Available services: ${services.map(s=>s.name).join(', ')}`);
    }
  }
}
