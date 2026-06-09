import { BladeAction, putBladeData } from '../../../lib/data-store';

export async function main(ns: NS) {
  const { bladeburner: bb } = ns;

  const ACTION_NAMES: Record<BladeburnerActionType, BladeburnerActionName[]> = {
    General: bb.getGeneralActionNames(),
    Contracts: bb.getContractNames(),
    Operations: bb.getOperationNames(),
    'Black Operations': bb.getBlackOpNames(),
  };

  const actionPairs = Object.entries(ACTION_NAMES) as [
    BladeburnerActionType,
    BladeburnerActionName[],
  ][];

  const getActions = (
    type: BladeburnerActionType,
    names: BladeburnerActionName[],
  ) =>
    Object.fromEntries(
      names.map((name) => [
        name,
        {
          estimatedChance: bb.getActionEstimatedSuccessChance(type, name),
          actionCountRemaining: bb.getActionCountRemaining(type, name),
        },
      ]),
    ) as Record<BladeburnerActionName, BladeAction>;

  const actions = Object.fromEntries(
    actionPairs.map(([type, names]) => [type, getActions(type, names)]),
  ) as Record<BladeburnerActionType, ReturnType<typeof getActions>>;

  putBladeData(ns, { actions });
}
