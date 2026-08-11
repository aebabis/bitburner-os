import Ports from './ports.ts';
import {
  PORT_HOSTNAMES,
  PORT_STATIC_DATA,
  PORT_SCH_REPORTING,
  PORT_PLAYER_DATA,
  PORT_MONEY_DATA,
  PORT_RAM_POLICY,
} from '../etc/ports.ts';

const readData = (ns: NS, port: number) => Ports(ns).getPortHandle(port).peek();

const replaceData = (ns: NS, portId: number, data: unknown) => {
  const port = Ports(ns).getPortHandle(portId);
  port.clear();
  port.write(data);
};

const putData = (ns: NS, portId: number, data: unknown) => {
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
export const putSchedulerReportData = (ns: NS, data: Partial<SchedulerReportData>) =>
  putData(ns, PORT_SCH_REPORTING, data);

type BackdoorRequirement = {
  hostname: string;
  requiredHackingLevel: number;
  numPortsRequired: number;
};

export type Augmentation = {
  name: string;
  price: number;
  repReq: number;
  prereqs: string[];
  stats: Multipliers;
  factions: FactionName[];
};

export type SingularityData = {
  factionFavor: Record<FactionName, number>;
  augmentations: Augmentation[];
  augmentationNames: string[];
  augmentationPrices: Record<string, number>;
  augmentationRepReqs: Record<string, number>;
  augmentationPrereqs: Record<string, string[]>;
  augmentationStats: Record<string, Multipliers>;
  factionRequirements: Record<FactionName, PlayerRequirement[]>;
  factionEnemies: Record<FactionName, FactionName[]>;
  factionAugmentations: Record<FactionName, string[]>;
  factionWorkTypes: Record<FactionName, FactionWorkType[]>;

  companyFavor: Record<CompanyName, number>;
  companyPositions: Record<CompanyName, CompanyPositionInfo[]>;

  crimeStats: Record<CrimeType, CrimeStats>;
};

export type GraftData = {
  graftableAugmentations: string[];
  augmentationGraftPrices: Record<string, number>;
  augmentationGraftTimes: Record<string, number>;
};

export type StaticData = {
  resetInfo: ResetInfo;
  installedAugmentations: string[];
  scriptRam: Record<string, number>;
  serverBackdoorRequirements: BackdoorRequirement[];
  purchasedServerLimit: number;
  purchasedServerMaxRam: number;
  purchasedServerCosts: Record<number, number>;
  bitNodeMultipliers: BitNodeMultipliers | null;
  hacknetMultipliers: HacknetMultipliers;
  favorToDonate: number;
  startingServerValue: number;

  materialData?: Record<CorpMaterialName, CorpMaterialConstantData>;
  industryData?: Record<CorpIndustryName, CorpIndustryData>;

  singularityData?: SingularityData;
  graftingData?: GraftData;
};

export type SF4StaticData = StaticData & { singularityData: SingularityData };
export type SF10StaticData = StaticData & { graftingData: GraftData };

export const hasSingularityData = (staticData: StaticData): staticData is SF4StaticData =>
  staticData.singularityData != null;

export const hasGraftingData = (staticData: StaticData): staticData is SF10StaticData =>
  staticData.graftingData != null;
export const getStaticData = (ns: NS): StaticData => readData(ns, PORT_STATIC_DATA) || {};
export const putStaticData = (ns: NS, data: Partial<StaticData>) =>
  putData(ns, PORT_STATIC_DATA, data);

export type HacknetPurchase = {
  i: number;
  type: 'level' | 'ram' | 'cores' | 'node';
  cost: number;
  hashrateGain: number;
  utility: number;
  breakEvenTime: number;
};

export type PlayerData = {
  player: Player;
  factionRep?: Record<FactionName, number>;
  bladeburnerRepRate?: number;
  currentWork?: Task | null;
  homeRamUpgradeCost?: number;
  isPlayerUsingTerminal?: boolean;
  queuedAugmentations?: string[];
  hacknet?: {
    servers: NodeStats[];
    studyMult: number;
    trainingMult: number;
    nextUpgrade: {
      upgrade: HacknetServerHashUpgrade;
      currentLevel: number;
      cost: number;
    };
    nextPurchase: HacknetPurchase | null;
    hashes: number;
    capacity: number;
  };
  contracts?: {
    completed: number;
    failures: number;
    unsupported: CodingContractName[];
  };
  hasGift?: boolean;
  stanekLayout?: {
    width: number;
    height: number;
    fragments: ActiveFragment[];
  };
  fragmentMultipliers?: Record<FragmentType, number>;
  graftCompletionTime?: number;
  unlockedAchievements?: string[];

  homeRam: number;
  wseAccount: boolean;
  accessTixApi: boolean;
  access4SData: boolean;
  access4SDataApi: boolean;
};
export const getPlayerData = (ns: NS): PlayerData => readData(ns, PORT_PLAYER_DATA) || {};
export const putPlayerData = (ns: NS, data: Partial<PlayerData>) =>
  putData(ns, PORT_PLAYER_DATA, data);

const DEFAULT_MONEY_DATA = {
  hacknetIncome: 0,
  gangIncome: 0,
  stockIncome: 0,
  theftIncome: 0,
  estimatedStockValue: 0,
  dividendEarnings: 0,
  darknetIncome: 0,
  manualHackIncome: 0,
  casinoIncome: 0,
  totalIncome: 0,

  casinoEarnings: 0,
  theftRatePerGB: 0,
  theft: {
    target: '',
    money: 0,
    time: 0,
    incomeRate: 0,
    endTime: 0,
  },
  graftPriceReserve: 0,
};
export type MoneyData = typeof DEFAULT_MONEY_DATA;
export const getMoneyData = (ns: NS): MoneyData =>
  Object.assign({}, DEFAULT_MONEY_DATA, readData(ns, PORT_MONEY_DATA) || {});
export const putMoneyData = (ns: NS, data: Partial<MoneyData>) =>
  putData(ns, PORT_MONEY_DATA, data);

export type RamPolicySnapshot = {
  totalRam: number;
  homeReserve: number;
  currentServiceRam: number;
  allottedShareRam: number;
  allottedStanekRam: number;
  allottedBatchRam: number;
  stanekHost: string | null;
};
export const getRamPolicy = (ns: NS): RamPolicySnapshot | null => readData(ns, PORT_RAM_POLICY);
export const putRamPolicy = (ns: NS, data: RamPolicySnapshot) => putData(ns, PORT_RAM_POLICY, data);
