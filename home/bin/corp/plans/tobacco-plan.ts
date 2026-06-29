import { DivisionNames } from '../constants';
import { createPlan, getIndustrySetupCost } from '../plan.rip';

const AgDiv = DivisionNames['Agriculture'];
const ChemDiv = DivisionNames['Chemical'];
const TobDiv = DivisionNames['Tobacco'];

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
    .setupExport(AgDiv, TobDiv, 'Plants')
    .setupExport(AgDiv, ChemDiv, 'Plants') // Replace old one so tobacco gets 1st dibs
    .assignEmployees(TobDiv, [1, 1, 0, 1, 0, 0])
    .expandWarehouses(TobDiv, 2)
    .expandOffices(TobDiv, [14, 10, 8, 10, 8, 0], 'Sector-12')
    .expandOffices(TobDiv, [5, 5, 5, 5, 20, 0], 'Aevum')
    .advertise(TobDiv, 1)

    .expandWarehouses(AgDiv, 4)
    .purchaseUpgrades({
      'Smart Factories': 3,
      'Smart Storage': 3,
    });
