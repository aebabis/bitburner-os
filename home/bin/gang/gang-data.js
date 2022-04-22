import { GANG_DATA } from './etc/filenames';
import { logger } from './lib/logger';

/** @param {NS} ns **/
export async function main(ns) {
    // let taskNames;
    if (!ns.gang.inGang())
        return;
    // try {
    const taskNames = ns.gang.getTaskNames();
    // } catch (error) {
    //     logger(ns).info('No access to gang API');
    //     return;
    // }
    try {
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
    
        const gangData = {
            tasks,
            taskNames,
            taskStats,
            equipment,
            equipmentNames,
            equipmentStats,
            equipmentTypes,
        };
    
        await ns.write(GANG_DATA, JSON.stringify(gangData, null, 2), 'w');
    } catch (error) {
        logger(ns).error(error);
    }
}