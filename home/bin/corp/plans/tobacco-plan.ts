import { DivisionNames } from '../constants';
import { createPlan, getIndustrySetupCost } from '../plan.rip';

const AgDiv = DivisionNames['Agriculture'];
const ChemDiv = DivisionNames['Chemical'];

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
    .waitForInvestment(1, getIndustrySetupCost(ns, industryData)('Chemical'))
    .openDivision('Chemical', ChemDiv)
    .setupExport(AgDiv, ChemDiv, 'Plants')
    .setupExport(ChemDiv, AgDiv, 'Chemicals')
    .assignEmployees(ChemDiv, [1, 1, 0, 1, 0, 0])
    .expandWarehouses(ChemDiv, 2)
    .expandOffices(ChemDiv, [2, 2, 0, 1, 1, 0])
    .expandOffices(AgDiv, [2, 2, 1, 2, 1, 0])
    .expandWarehouses(AgDiv, 4)
    .purchaseUpgrades({
      'Smart Factories': 3,
      'Smart Storage': 3,
    });
