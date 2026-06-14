import Ports from './ports.ts';
import {
  PORT_HOSTNAMES,
  PORT_STATIC_DATA,
  PORT_GANG_DATA,
  PORT_SCH_RAM_DATA,
  PORT_SCH_REPORTING,
  PORT_PLAYER_DATA,
  PORT_MONEY_DATA,
  PORT_CONTRACT_DATA,
  PORT_CORP_REPORTS,
  PORT_BLADE_REPORTS,
} from '../etc/ports.ts';
import { DivisionName } from '../bin/corporation/constants.ts';

const readData = (ns: NS, port: number) => Ports(ns).getPortHandle(port).peek();

const replaceData = (ns: NS, portId: number, data) => {
  const port = Ports(ns).getPortHandle(portId);
  port.clear();
  port.write(data);
};

const putData = (ns: NS, portId: number, data) => {
  const oldData = readData(ns, portId) || {};
  const newData = Object.assign(oldData, data);
  const port = Ports(ns).getPortHandle(portId);
  port.clear();
  port.write(newData);
};

export const getHostnames = (ns: NS): string[] => readData(ns, PORT_HOSTNAMES);
export const putHostnames = (ns: NS, hostnames: string[]) =>
  replaceData(ns, PORT_HOSTNAMES, hostnames);

type SchedulerReportData = {
  inputFull: boolean;
  outputFull: boolean;
  heartbeat: number;
  maxWaitTime: number;
  enqueueFails: number;
  droppedTickets: number;
  lastRuns: Record<string, number>;
  lastCancellations: Record<string, number>;
};
export const getSchedulerReportData = (ns: NS): SchedulerReportData =>
  readData(ns, PORT_SCH_REPORTING) || {};
export const putSchedulerReportData = (ns: NS, data: SchedulerReportData) =>
  putData(ns, PORT_SCH_REPORTING, data);

type BackdoorRequirement = {
  hostname: string;
  requiredHackingLevel: number;
  numPortsRequired: number;
};

export type StaticStockData = {
  sym: string;
  maxShares: number;
};

export type StaticData = {
  resetInfo: ResetInfo;
  installedAugmentations: string[];
  scriptRam: Record<string, number>;
  serverBackdoorRequirements: BackdoorRequirement[];
  purchasedServerLimit: number;
  purchasedServerMaxRam: number;
  purchasedServerCosts: Record<number, number>;
  requiredJobRam: number;
  requiredAugRam: number;
  bitNodeMultipliers: { HacknetNodeMoney: number | null };
  hacknetMultipliers: HacknetMultipliers;
  favorToDonate: number;

  materialData?: Record<CorpMaterialName, CorpMaterialConstantData>;
  industryData?: Record<CorpIndustryName, CorpIndustryData>;

  stocks?: StaticStockData[];
  factionFavor?: Record<FactionName, number>;
  augmentations?: string[];
  augmentationPrices?: Record<string, number>;
  augmentationRepReqs?: Record<string, number>;
  augmentationPrereqs?: Record<string, string[]>;
  augmentationStats?: Record<string, Multipliers>;
  purchasedAugmentations?: string[];
  factionRequirements?: Record<FactionName, PlayerRequirement[]>;
  factionAugmentations?: Record<FactionName, string[]>;
  factionWorkTypes?: Record<FactionName, FactionWorkType[]>;
  // TODO: Move this to playerData; it changes
  factionFavorGain?: Record<FactionName, number>;
};
export const getStaticData = (ns: NS): StaticData =>
  readData(ns, PORT_STATIC_DATA) || {};
export const putStaticData = (ns: NS, data: Partial<StaticData>) =>
  putData(ns, PORT_STATIC_DATA, data);

type GangData =
  | {
      isReady: false;
      gangInfo?: GangGenInfo;
      allGangInfo?: Record<string, GangOtherInfoObject>;
      memberNames?: string[];
    }
  | {
      isReady: true;
      gangInfo: GangGenInfo;
      allGangInfo: Record<string, GangOtherInfoObject>;
      memberNames: string[];
    };
export const getGangData = (ns: NS): GangData => readData(ns, PORT_GANG_DATA);
export const putGangData = (ns: NS, data: Partial<GangData>) =>
  putData(ns, PORT_GANG_DATA, data);

export type ServerRamInfo = {
  hostname: string;
  maxRam: number;
  ramUsed: number;
  ramUnused: number;
};
type RamData = {
  rootServers?: Server[];
  purchasedServers?: ServerRamInfo[];
};
export const getRamData = (ns: NS): RamData =>
  readData(ns, PORT_SCH_RAM_DATA) || {};
export const putRamData = (ns: NS, data: RamData) =>
  replaceData(ns, PORT_SCH_RAM_DATA, data);

export type PlayerData = {
  player: Player;
  factionRep?: Record<FactionName, number>;
  currentWork?: Task | null;
  /** Augmentations purchased this run (and not yet installed) */
  purchasedAugmentations: string[];
};
export const getPlayerData = (ns: NS): PlayerData =>
  readData(ns, PORT_PLAYER_DATA) || {};
export const putPlayerData = (ns: NS, data: Partial<PlayerData>) =>
  putData(ns, PORT_PLAYER_DATA, data);

const DEFAULT_MONEY_DATA = {
  hacknetIncome: 0,
  gangIncome: 0,
  stockIncome: 0,
  theftIncome: 0,
  estimatedStockValue: 0,
  totalIncome: 0,

  theftRatePerGB: 0,
  theft: {
    target: '',
    money: 0,
    time: 0,
    incomeRate: 0,
    endTime: 0,
  },
};
export type MoneyData = typeof DEFAULT_MONEY_DATA;
export const getMoneyData = (ns: NS): MoneyData =>
  Object.assign({}, DEFAULT_MONEY_DATA, readData(ns, PORT_MONEY_DATA) || {});
export const putMoneyData = (ns: NS, data: Partial<MoneyData>) =>
  putData(ns, PORT_MONEY_DATA, data);

export type StoredContract = {
  hostname: string;
  filename: string;
  type: string;
  tries: number;
  maxTries: number;
};
type ContractData = { contracts: StoredContract[] };
export const getContractData = (ns: NS): ContractData =>
  readData(ns, PORT_CONTRACT_DATA) || {};
export const putContractData = (ns: NS, data: ContractData) =>
  putData(ns, PORT_CONTRACT_DATA, data);

type CorpReports = Record<DivisionName, string[][]>;
export const getCorpReports = (ns: NS): CorpReports =>
  readData(ns, PORT_CORP_REPORTS) || {};
export const putCorpReports = (ns: NS, data: Partial<CorpReports>) =>
  putData(ns, PORT_CORP_REPORTS, data);

export type BladeAction = {
  estimatedChance: [number, number];
  actionCountRemaining: number;
  duration: number;
};
export type BladeCurrentAction =
  | {
      type: 'General';
      name: BladeburnerGeneralActionName;
      time: number;
    }
  | {
      type: 'Contracts';
      name: BladeburnerContractName;
      time: number;
    }
  | {
      type: 'Operations';
      name: BladeburnerOperationName;
      time: number;
    }
  | {
      type: 'Black Operations';
      name: BladeburnerBlackOpName;
      time: number;
    };
type BladeData = {
  actions: {
    General: Record<BladeburnerGeneralActionName, BladeAction>;
    Contracts: Record<BladeburnerContractName, BladeAction>;
    Operations: Record<BladeburnerOperationName, BladeAction>;
    'Black Operations': Record<BladeburnerBlackOpName, BladeAction>;
  };
  cities: Record<
    CityName,
    {
      estimatedPopulation: number;
      chaos: number;
      communities: number;
    }
  >;
  currentAction: BladeCurrentAction | null;
  skills: {
    name: BladeburnerSkillName;
    cost: number;
    level: number;
    limit: number;
    upgradedThisTick: boolean;
  }[];
};
export const getBladeData = (ns: NS): BladeData =>
  readData(ns, PORT_BLADE_REPORTS) || {};
export const putBladeData = (ns: NS, data: Partial<BladeData>) =>
  putData(ns, PORT_BLADE_REPORTS, data);
