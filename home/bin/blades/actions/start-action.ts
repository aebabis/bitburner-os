import { BladeCurrentAction, putBladeData } from '../../../lib/data-store';
import { joinSpawnChain } from '../../../lib/service-api';

export async function main(ns: NS) {
  const { linkTo } = joinSpawnChain(ns, '/bin/blades/blades.ts');
  const [type, name] = ns.args as [BladeburnerActionType, BladeburnerActionName];
  const current = ns.bladeburner.getCurrentAction();
  if (current == null || current.type !== type || current.name !== name) {
    ns.bladeburner.startAction(type, name);
  }

  const currentAction = current
    ? ({
        type: current.type as BladeburnerActionType,
        name: current.name as BladeburnerActionName,
        time: ns.bladeburner.getActionCurrentTime(),
      } as BladeCurrentAction)
    : null;

  putBladeData(ns, { currentAction });
  await linkTo('/bin/blades/actions/end.ts', 0);
}
