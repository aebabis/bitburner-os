import { DivisionNames } from '../constants';
import { createPlan, getIndustrySetupCost } from '../plan.rip';

const AgDiv = DivisionNames['Agriculture'];
const ChemDiv = DivisionNames['Chemical'];
const HardDiv = DivisionNames['Computer Hardware'];
const MineDiv = DivisionNames['Mining'];
const RefDiv = DivisionNames['Refinery'];
const TobDiv = DivisionNames['Tobacco'];
const WatDiv = DivisionNames['Water Utilities'];

export const getTobaccoPlan = (
  ns: NS,
  industryData: Record<CorpIndustryName, CorpIndustryData>,
  materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
) =>
  createPlan(ns, industryData, materialData)
    .openDivision('Agriculture', AgDiv)
    .assignEmployees(AgDiv, [1, 1, 0, 1, 0, 0])
    .expandOffices(AgDiv, [1, 2, 1, 1, 1, 0])
    .expandWarehouses(AgDiv, 2)
    .buyUnlock('Smart Supply')
    .enableSmartSupply(AgDiv)
    .advertise(AgDiv, 1)

    .waitForInvestment(1, getIndustrySetupCost(ns, industryData)('Chemical') + 20e9)

    .openDivision('Chemical', ChemDiv)
    .buyUnlock('Export')
    .setupExport(AgDiv, ChemDiv, 'Plants')
    .setupExport(ChemDiv, AgDiv, 'Chemicals')
    .assignEmployees(ChemDiv, [1, 1, 0, 1, 0, 0])
    .expandWarehouses(ChemDiv, 2)
    .expandOffices(ChemDiv, [2, 2, 0, 1, 1, 0])
    .expandOffices(AgDiv, [2, 2, 1, 2, 1, 0])

    .waitForInvestment(2, 500e9)

    .openDivision('Tobacco', TobDiv)
    // Plants is Tobacco's only required material
    .setupExport(AgDiv, TobDiv, 'Plants')
    .setupExport(AgDiv, ChemDiv, 'Plants') // Replace old one so tobacco gets 1st dibs
    .assignEmployees(TobDiv, [1, 1, 0, 1, 0, 0])
    .expandWarehouses(TobDiv, 2)
    .expandOffices(TobDiv, [0, 0, 0, 0, 6, 0])
    .expandOffices(TobDiv, [14, 10, 8, 10, 8, 0], 'Sector-12')
    .advertise(TobDiv, 1)

    .expandWarehouses(AgDiv, 4)
    .purchaseUpgrades({ 'Smart Factories': 3, 'Smart Storage': 3 })
    .expandWarehouses(TobDiv, 3)
    .purchaseUpgrades({
      'Smart Factories': 10,
      'Smart Storage': 10,
      'Project Insight': 10,
      'Wilson Analytics': 3,
    })
    .expandWarehouses(AgDiv, 5)
    .expandWarehouses(TobDiv, 6)
    .purchaseUpgradesByCost(2e9)

    .waitForInvestment(3, 15e11)

    .purchaseUpgrades({ 'Project Insight': 40 })
    .purchaseUpgrades({ 'Smart Factories': 20, 'Smart Storage': 20, 'Wilson Analytics': 5 })
    .purchaseUpgradesByCost(100e9)

    .expandOffices(TobDiv, [7, 4, 4, 4, 2, 0])
    .expandOffices(TobDiv, [14, 10, 8, 10, 8, 0], 'Sector-12')
    .purchaseUpgradesByCost(200e9)
    .expandOffices(TobDiv, [14, 10, 8, 8, 10, 0])
    .purchaseUpgradesByCost(400e9)
    .expandOffices(TobDiv, [20, 16, 12, 12, 10, 0])

    .openDivision('Water Utilities', WatDiv)
    .setupExport(WatDiv, AgDiv, 'Water')
    .setupExport(WatDiv, ChemDiv, 'Water')
    .expandOffices(WatDiv, [4, 4, 2, 4, 1, 0])
    .expandOffices(AgDiv, [4, 4, 2, 4, 1, 0])

    .openDivision('Computer Hardware', HardDiv)
    .setupExport(HardDiv, WatDiv, 'Hardware')
    .expandOffices(HardDiv, [10, 8, 2, 8, 1, 0])

    .openDivision('Refinery', RefDiv)
    .setupExport(RefDiv, HardDiv, 'Metal')
    .expandOffices(RefDiv, [4, 4, 2, 4, 1, 0])

    .openDivision('Mining', MineDiv)
    .setupExport(MineDiv, RefDiv, 'Ore')
    .expandOffices(MineDiv, [10, 8, 2, 8, 1, 0])
    .setupExport(HardDiv, MineDiv, 'Hardware')

    .purchaseUpgradesByCost(500e12)
    .buyUnlock('Shady Accounting')
    .expandOffices(AgDiv, [20, 20, 5, 20, 1, 0])
    .explode(
      [
        [TobDiv, Infinity],
        [AgDiv, 200],
      ],
      [AgDiv, ChemDiv, HardDiv, MineDiv, RefDiv, TobDiv, WatDiv],
    );
