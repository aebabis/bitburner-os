import { logger } from './lib/logger';
import { putGangData } from './lib/data-store';

/** @param {NS} ns **/
export async function main(ns) {
    if (!ns.gang.inGang())
        return;
    try {
        const taskNames = ns.gang.getTaskNames();
        const taskStats = taskNames.reduce((obj, name) => {
            obj[name] = ns.gang.getTaskStats(name);
            return obj;
        }, {});
        const tasks = Object.values(taskStats);
    
        const equipmentNames = ns.gang.getEquipmentNames();
        const equipmentStats = equipmentNames.reduce((obj, name) => {
            obj[name] = ns.gang.getEquipmentStats(name);
            return obj;
        }, {});
        const equipmentTypes = equipmentNames.reduce((obj, name) => {
            equipmentStats[name].type = obj[name] = ns.gang.getEquipmentType(name);
            return obj;
        }, {})
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
    } catch (error) {
        logger(ns).error(error);
    }
}