export async function main(ns: NS) {
  const [type, name] = ns.args as [
    BladeburnerActionType,
    BladeburnerActionName,
  ];
  const current = ns.bladeburner.getCurrentAction();
  if (current == null || current.type !== type || current.name !== name) {
    ns.bladeburner.startAction(type, name);
  }
}
