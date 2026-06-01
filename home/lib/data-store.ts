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
} from '../etc/ports.ts';

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

export const getSchedulerReportData = (ns: NS) =>
  readData(ns, PORT_SCH_REPORTING) || {};
export const putSchedulerReportData = (ns: NS, data) =>
  putData(ns, PORT_SCH_REPORTING, data);

type BackdoorRequirement = {
  hostname: string;
  requiredHackingLevel: number;
  numPortsRequired: number;
};

type StaticStockData = {
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

  materialData?: Record<CorpMaterialName, CorpMaterialConstantData>;
  industryData?: Record<CorpIndustryName, CorpIndustryData>;

  stocks?: StaticStockData[];
  factionFavor?: Record<FactionName, number>;
  augmentations?: string[];
  augmentationPrices?: Record<string, number>;
  augmentationRepReqs?: Record<string, number>;
  augmentationStats?: Record<string, Multipliers>;
  purchasedAugmentations?: string[];
  factionRequirements?: Record<FactionName, PlayerRequirement[]>;
  factionWorkTypes?: Record<FactionName, FactionWorkType[]>;
  factionFavorGain?: Record<FactionName, number>;
  favorToDonate?: number;
};
export const getStaticData = (ns: NS): StaticData =>
  readData(ns, PORT_STATIC_DATA) || {};
export const putStaticData = (ns: NS, data: Partial<StaticData>) =>
  putData(ns, PORT_STATIC_DATA, data);

type GangData =
  | { isReady: false }
  | {
      isReady: true;
      gangInfo: GangGenInfo;
      allGangInfo: Record<string, GangOtherInfoObject>;
      memberNames: string[];
    };
export const getGangData = (ns: NS): GangData => readData(ns, PORT_GANG_DATA);
export const putGangData = (ns: NS, data: Partial<GangData>) =>
  putData(ns, PORT_GANG_DATA, data);

export const getRamData = (ns: NS) => readData(ns, PORT_SCH_RAM_DATA);
export const putRamData = (ns: NS, data) =>
  replaceData(ns, PORT_SCH_RAM_DATA, data);

export const getPlayerData = (ns: NS) => readData(ns, PORT_PLAYER_DATA) || {};
export const putPlayerData = (ns: NS, data) =>
  putData(ns, PORT_PLAYER_DATA, data);

export const getMoneyData = (ns: NS) => readData(ns, PORT_MONEY_DATA) || {};
export const putMoneyData = (ns: NS, data) =>
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

export const getCorpReports = (ns: NS) => readData(ns, PORT_CORP_REPORTS) || {};
export const putCorpReports = (ns: NS, data) =>
  putData(ns, PORT_CORP_REPORTS, data);
