import { BladeCurrentAction, putBladeData } from '../../../lib/data-store';

export async function main(ns: NS) {
  const [type, name] = ns.args as [
    BladeburnerActionType,
    BladeburnerActionName,
  ];
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
}
