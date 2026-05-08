import { putGangData } from "../../lib/data-store";

/** @param {NS} ns **/
export async function main(ns) {
  const taskNames = ns.gang.getTaskNames();
  const taskStats = /** @type {Record<string, GangTaskStats>} */ ({});
  for (const name of taskNames) taskStats[name] = ns.gang.getTaskStats(name);
  const tasks = Object.values(taskStats);

  const equipmentNames = ns.gang.getEquipmentNames();
  const equipmentStats = /** @type {Record<string, EquipmentStats & {type?: string}>} */ ({});
  const equipmentTypes = /** @type {Record<string, string>} */ ({});
  for (const name of equipmentNames)
    equipmentStats[name] = ns.gang.getEquipmentStats(name);
  for (const name of equipmentNames)
    equipmentTypes[name] = equipmentStats[name].type =
      ns.gang.getEquipmentType(name);
  const equipment = Object.values(equipmentStats);

  putGangData(ns, {
    tasks,
    taskNames,
    taskStats,
    equipment,
    equipmentNames,
    equipmentStats,
    equipmentTypes,
  });
}
