import { inPlace, runInPlace } from '../../lib/in-place';
import { DivisionName } from './constants';

type Step = {
  description: string;
  isDone: () => Promise<boolean>;
  canStart: () => Promise<boolean>;
  complete: () => Promise<boolean>;
};

export const getIndustrySetupCost =
  (ns: NS, industryData: Record<CorpIndustryName, CorpIndustryData>) =>
  (industryName: CorpIndustryName) => {
    const constants = ns.corporation.getConstants();
    const setupCost = 6 * (constants.officeInitialCost + constants.warehouseInitialCost);
    return industryData[industryName].startingCost + setupCost;
  };

const step = (
  description: string,
  {
    isDone,
    canStart,
    complete,
  }: {
    isDone: () => Promise<boolean>;
    canStart: () => Promise<boolean>;
    complete: () => Promise<boolean>;
  },
) => {
  let done = false;
  return {
    description,
    canStart: async () => {
      if (done) {
        throw new Error('Called canStart on already completed step: ' + description);
      }
      return canStart();
    },
    complete: async () => {
      if (done) {
        throw new Error('Tried to repeat step: ' + description);
      }
      const success = await complete();
      if (success) {
        const check = await isDone();
        if (!check) {
          throw new Error('Task completion did not fulfill isDone criteria: ' + description);
        }
        return (done = true);
      }
      return false;
    },
    isDone: async () => done || (done = await isDone()),
  };
};

export const createPlan = (
  ns: NS,
  industryData: Record<CorpIndustryName, CorpIndustryData>,
  materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
) => {
  type EmployeeCounts = [number, number, number, number, number, number];
  const CITIES = Object.values(ns.enums.CityName);
  const EMPLOYEE_SEQUENCE = [
    'Operations',
    'Engineer',
    'Business',
    'Management',
    'Research & Development',
    'Intern',
  ] as Exclude<CorpEmployeePosition, 'Unassigned'>[];
  const $ = inPlace(ns, ns.pid);
  const $rip = runInPlace(ns, ns.pid);
  let currentStepIndex = 0;
  const steps: Step[] = [];

  const plan = {
    buyUnlock: (unlock: CorpUnlockName) => {
      const isDone = () => $.corporation['hasUnlock'](unlock);
      const canStart = async () => {
        const cost = await $.corporation['getUnlockCost'](unlock);
        const corp = await $.corporation['getCorporation']();
        return corp.funds >= cost;
      };
      const complete = async () => {
        await $.corporation['purchaseUnlock'](unlock);
        return true;
      };
      steps.push(step(`Purchase ${unlock}`, { isDone, canStart, complete }));
      return plan;
    },

    openDivision: (industryName: CorpIndustryName, divisionName: DivisionName) => {
      const totalCost = getIndustrySetupCost(ns, industryData)(industryName);
      const isDone = async () => {
        const corp = await $.corporation['getCorporation']();
        if (!corp.divisions.includes(divisionName)) return false;
        const division = await $.corporation['getDivision'](divisionName);
        return $rip((division) => {
          for (const cityName of Object.values(ns.enums.CityName)) {
            if (!division.cities.includes(cityName)) return false;
            if (!ns.corporation['hasWarehouse'](division.name, cityName)) return false;
          }
          return true;
        })(division);
      };
      const canStart = async () => {
        const corp = await $.corporation['getCorporation']();
        return corp.funds >= totalCost;
      };
      const complete = async () => {
        try {
          const corp = await $.corporation['getCorporation']();
          if (!corp.divisions.includes(divisionName)) {
            await $.corporation['expandIndustry'](industryName, divisionName);
          }
          const division = await $.corporation['getDivision'](divisionName);
          for (const cityName of CITIES) {
            if (!division.cities.includes(cityName)) {
              await $.corporation['expandCity'](divisionName, cityName);
            }
            if (!(await $.corporation['hasWarehouse'](division.name, cityName))) {
              await $.corporation['purchaseWarehouse'](divisionName, cityName);
            }
          }
        } catch (error) {
          ns.tprint(error);
          return false;
        }
        return true;
      };
      const desc = `Open ${divisionName} ($${ns.format.number(totalCost)})`;
      steps.push(step(desc, { isDone, canStart, complete }));
      return plan;
    },

    setupExport: (
      fromDivision: DivisionName,
      toDivision: DivisionName,
      material: CorpMaterialName,
      amount = '(-IPROD-IINV)/10',
    ) => {
      let wasCompleted = false; // assignEmployees overrides post-competion isDone check because results are asyncronous
      const isDone = async () => wasCompleted;
      const canStart = async () => true;
      const complete = async () => {
        for (const cityName of CITIES) {
          await $.corporation['cancelExportMaterial'](
            fromDivision,
            cityName,
            toDivision,
            cityName,
            material,
          );
          await $.corporation['exportMaterial'](
            fromDivision,
            cityName,
            toDivision,
            cityName,
            material,
            amount,
          );
        }
        return (wasCompleted = true);
      };
      const desc = `Setup Export of ${material} from ${fromDivision} to ${toDivision}`;
      steps.push(step(desc, { isDone, canStart, complete }));
      return plan;
    },

    enableSmartSupply: (divisionName: DivisionName, cityName?: CityName) => {
      const cities = cityName != null ? [cityName] : CITIES;
      const isDone = async () => {
        for (const cityName of cities) {
          const warehouse = await $.corporation['getWarehouse'](divisionName, cityName);
          if (!warehouse.smartSupplyEnabled) {
            return false;
          }
        }
        return true;
      };
      const canStart = async () => true;
      const complete = async () => {
        for (const cityName of cities) {
          await $.corporation['setSmartSupply'](divisionName, cityName, true);
        }
        return true;
      };
      const officeName = cityName ? cityName : 'all locations';
      steps.push(
        step(`Enable ${divisionName} Smart Supply in ${officeName}`, {
          isDone,
          canStart,
          complete,
        }),
      );
      return plan;
    },

    assignEmployees: (
      divisionName: DivisionName,
      employeeAllocation: [number, number, number, number, number, number],
      cityName?: CityName,
    ) => {
      const cities = cityName != null ? [cityName] : CITIES;
      let wasCompleted = false; // assignEmployees overrides post-competion isDone check because results are asyncronous
      const isDone = async () => wasCompleted;
      const canStart = async () => true;
      const complete = async () => {
        const jobsToAssign = employeeAllocation.reduce((a, b) => a + b, 0);
        for (const cityName of cities) {
          const office = await $.corporation['getOffice'](divisionName, cityName);
          let numNeeded = jobsToAssign - office.numEmployees;
          if (numNeeded) console.log('still need ' + numNeeded + ' employees in ' + cityName);
          while (numNeeded > 0) {
            if (!(await $.corporation['hireEmployee'](divisionName, cityName))) return false;
          }
        }
        return (wasCompleted = await $rip(
          (
            divisionName: DivisionName,
            cities: CityName[],
            employeeAllocation: EmployeeCounts,
            seq: typeof EMPLOYEE_SEQUENCE,
          ) => {
            let allSet = true;
            for (const cityName of cities) {
              for (let roleIndex = 0; roleIndex < employeeAllocation.length; roleIndex++) {
                allSet =
                  allSet &&
                  ns.corporation['setJobAssignment'](divisionName, cityName, seq[roleIndex], 0);
              }
              for (let roleIndex = 0; roleIndex < employeeAllocation.length; roleIndex++) {
                allSet =
                  allSet &&
                  ns.corporation['setJobAssignment'](
                    divisionName,
                    cityName,
                    seq[roleIndex],
                    employeeAllocation[roleIndex],
                  );
              }
            }
            return allSet;
          },
        )(divisionName, cities, employeeAllocation, EMPLOYEE_SEQUENCE));
      };
      const officeName = cityName ? cityName : 'all locations';
      steps.push(
        step(`Assign ${divisionName} employees in ${officeName}: ${employeeAllocation}`, {
          isDone,
          canStart,
          complete,
        }),
      );
      return plan;
    },

    expandOffices: (
      divisionName: DivisionName,
      employeeAllocation: [number, number, number, number, number, number],
      cityName?: CityName,
    ) => {
      const cities = cityName != null ? [cityName] : CITIES;
      const targetSize = employeeAllocation.reduce((a, b) => a + b, 0);
      const isDone = () =>
        $rip((divisionName: DivisionName, cities: CityName[], targetSize: number) =>
          cities.every(
            (cityName) => ns.corporation['getOffice'](divisionName, cityName).size >= targetSize,
          ),
        )(divisionName, cities, targetSize);
      const canStart = async () => {
        const totalCost = await $rip(
          (divisionName: DivisionName, cities: CityName[], targetSize: number) =>
            cities
              .map((cityName) => {
                const office = ns.corporation['getOffice'](divisionName, cityName);
                const spotsNeeded = targetSize - office.size;
                return ns.corporation['getOfficeSizeUpgradeCost'](
                  divisionName,
                  cityName,
                  spotsNeeded,
                );
              })
              .reduce((a, b) => a + b, 0),
        )(divisionName, cities, targetSize);
        const { funds } = await $.corporation['getCorporation']();
        return funds >= totalCost;
      };
      const complete = async () => {
        for (const cityName of cities) {
          const office = await $.corporation['getOffice'](divisionName, cityName);
          await $.corporation['upgradeOfficeSize'](
            divisionName,
            cityName,
            targetSize - office.size,
          );
        }
        return true;
      };
      const officeName = cityName ? cityName : 'all locations';
      steps.push(
        step(
          `Expand ${divisionName} office in ${officeName} for headcounts: ${employeeAllocation}`,
          { isDone, canStart, complete },
        ),
      );
      plan.assignEmployees(divisionName, employeeAllocation, cityName);
      return plan;
    },

    expandWarehouses: (divisionName: DivisionName, warehouseLevel: number, cityName?: CityName) => {
      const cities = cityName != null ? [cityName] : CITIES;
      const isDone = () =>
        $rip((divisionName: DivisionName, cities: CityName[], targetLevel: number) =>
          cities.every(
            (cityName) =>
              ns.corporation['getWarehouse'](divisionName, cityName).level >= targetLevel,
          ),
        )(divisionName, cities, warehouseLevel);
      const canStart = async () => {
        const totalCost = await $rip(
          (divisionName: DivisionName, cities: CityName[], targetLevel: number) =>
            cities
              .map((cityName) => {
                const warehouse = ns.corporation['getWarehouse'](divisionName, cityName);
                const upgradeCount = targetLevel - warehouse.level;
                if (upgradeCount <= 0) return 0;
                return ns.corporation['getUpgradeWarehouseCost'](
                  divisionName,
                  cityName,
                  upgradeCount,
                );
              })
              .reduce((a, b) => a + b, 0),
        )(divisionName, cities, warehouseLevel);
        const { funds } = await $.corporation['getCorporation']();
        return funds >= totalCost;
      };
      const complete = async () => {
        for (const cityName of cities) {
          const warehouse = await $.corporation['getWarehouse'](divisionName, cityName);
          const upgradeCount = warehouseLevel - warehouse.level;
          if (upgradeCount > 0) {
            await $.corporation['upgradeWarehouse'](
              divisionName,
              cityName,
              warehouseLevel - warehouse.level,
            );
          }
        }
        return true;
      };
      const officeName = cityName ? cityName : 'all locations';
      steps.push(
        step(`Expand ${divisionName} warehouse in ${officeName} to level ${warehouseLevel}`, {
          isDone,
          canStart,
          complete,
        }),
      );
      return plan;
    },

    advertise: (divisionName: DivisionName, targetLevel: number) => {
      const $stillNeeded = async () => {
        const currentLevel = await $.corporation['getHireAdVertCount'](divisionName);
        return currentLevel < targetLevel;
      };
      const isDone = async () => !(await $stillNeeded());
      const canStart = async () => {
        const { funds } = await $.corporation['getCorporation']();
        const cost = await $.corporation['getHireAdVertCost'](divisionName);
        return funds >= cost;
      };
      const complete = async () => {
        while (await $stillNeeded()) {
          await $.corporation['hireAdVert'](divisionName);
        }
        return true;
      };
      steps.push(step('Advertise', { isDone, canStart, complete }));
      return plan;
    },

    purchaseUpgrades: (upgrades: Partial<Record<CorpUpgradeName, number>>) => {
      const $stillNeeded = () =>
        $rip((upgrades) =>
          (Object.entries(upgrades) as [CorpUpgradeName, number][])
            .filter(([upgrade, level]) => ns.corporation['getUpgradeLevel'](upgrade) < level)
            .map(([upgrade]) => upgrade),
        )(upgrades);
      const isDone = async () => (await $stillNeeded()).length === 0;
      const canStart = async () => true;
      const complete = async () => {
        while (true) {
          const stillNeeded = await $stillNeeded();
          if (stillNeeded.length === 0) {
            return true;
          }
          const cheapest = await $rip((upgradeNames) =>
            upgradeNames.reduce((n1: CorpUpgradeName, n2: CorpUpgradeName) =>
              ns.corporation['getUpgradeLevelCost'](n1) < ns.corporation['getUpgradeLevelCost'](n2)
                ? n1
                : n2,
            ),
          )(stillNeeded);
          try {
            await $.corporation['levelUpgrade'](cheapest);
          } catch (error) {
            return false;
          }
        }
      };
      steps.push(
        step(`Purchase upgrades: ${JSON.stringify(upgrades).replaceAll(/{}"/g, '')}`, {
          isDone,
          canStart,
          complete,
        }),
      );
      return plan;
    },

    waitForInvestment: (investmentNumber: number, minimum?: number) => {
      const isDone = async () =>
        (await $.corporation['getInvestmentOffer']()).round > investmentNumber;
      const canStart = async () => {
        if (minimum == null) {
          // If a minimum is not specified, allow consumer script
          // to control accepting the offer
          return false;
        } else {
          return (await $.corporation['getInvestmentOffer']()).funds >= minimum;
        }
      };
      const complete = async () => $.corporation['acceptInvestmentOffer']();
      const description =
        minimum == null
          ? `Await completion of investment round ${investmentNumber}`
          : `Await investment offer of $${ns.format.number(minimum)}`;
      steps.push(step(description, { isDone, canStart, complete }));
      return plan;
    },

    isComplete: () => currentStepIndex === steps.length,

    advance: async () => {
      let currentStep: Step;
      while ((currentStep = steps[currentStepIndex])) {
        if (await currentStep.isDone()) {
          console.log(currentStep.description, 'done');
          currentStepIndex++;
        } else if (await currentStep.canStart()) {
          console.log(currentStep.description, 'starting');
          if (await currentStep.complete()) {
            console.log(currentStep.description, 'succeeded');
            currentStepIndex++;
          } else {
            console.log(currentStep.description, 'failed');
            break;
          }
        } else {
          console.log('could not complete ' + currentStep.description, 'waiting to next cycle');
          break;
        }
      }
    },

    getReport: (mapper = (str: string, isDone: boolean) => `${isDone ? ' ✓' : '  '} ${str}`) =>
      steps.map((step) => step.description).map((str, i) => mapper(str, i < currentStepIndex)),
  };

  return plan;
};
