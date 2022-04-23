import { PORT_GANG_DATA } from './etc/ports';
import { logger } from './lib/logger';
import Ports from './lib/ports';

/** @param {NS} ns **/
export async function main(ns) {
    const port =  Ports(ns).getPortHandle(PORT_GANG_DATA);
    port.clear();
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

        port.write({
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