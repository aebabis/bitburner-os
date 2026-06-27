import { DivisionNames } from '../constants';
import { createPlan } from '../plan.rip';

const AgDiv = DivisionNames['Agriculture'];

export const getTobaccoPlan = (
  ns: NS,
  industryData: Record<CorpIndustryName, CorpIndustryData>,
  materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
) =>
  createPlan(ns, industryData, materialData)
    .openDivision('Agriculture', AgDiv)
    .assignEmployees(AgDiv, [1, 1, 0, 1, 0, 0])
    .expandOffices(AgDiv, [1, 1, 1, 1, 1, 1])
    .expandWarehouses(AgDiv, 2)
    .buyUnlock('Smart Supply');
