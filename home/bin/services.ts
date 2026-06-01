import { KEYWORD } from '../lib/colors.ts';
import {
  getServices,
  enableService,
  disableService,
  getTableString,
} from '../lib/service-api.ts';

const HELP = [
  ['services enable <name|id> [--force]', 'enables a service'],
  ['services disable <name|id>', 'disables a service'],
  ['services tail <name|id>', 'opens tail associated with process'],
];
const LEFT_PAD = Math.max(...HELP.map((row) => row[0].length));

export async function main(ns: NS) {
  const flags = ns.flags([['force', false]]);
  const [command, target] = flags._ as string[];
  const force = flags.force as boolean;
  if (command == null) {
    ns.tprint(
      '\n' +
        getTableString(ns, getServices(ns)) +
        '\n' +
        HELP.map(
          (row) => KEYWORD(row[0].padEnd(LEFT_PAD)) + '\n  ' + row[1],
        ).join('\n'),
    );
    ('services enable <name|pid> [--force]: enables a service\n');
  } else if (command === 'enable') enableService(ns, target, force);
  else if (command === 'disable') disableService(ns, target);
  else if (command === 'tail') {
    const services = getServices(ns);
    const service = services.find(
      (service) => service.id === target || service.name === target,
    );
    if (service != null) ns.ui.openTail(service.pid);
    else {
      ns.tprint(`Service not found with descriptor "${target}"`);
      ns.tprint(
        `Available services: ${services.map((s) => s.name).join(', ')}`,
      );
    }
  } else {
    ns.tprint('Unrecognized command: ' + command);
  }
}
