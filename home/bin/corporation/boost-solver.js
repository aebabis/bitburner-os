import { getStaticData } from '../../lib/data-store';

/** @param {number} a
 *  @param {number} b */
const sum = (a, b) => a + b;

/** @param {number} S
 * @param {[number, number][]} csPairs
 * @return {number[]}
 */
export const solveBoost = (S, ...csPairs) => {
  const cs = csPairs.map(([c]) => c).reduce(sum);
  const amounts = csPairs.map(([c, s], i) => {
    const others = csPairs.filter((_, idx) => idx !== i);
    const oc = others.map(([c]) => c).reduce(sum);
    const os = others.map(([, s]) => s).reduce(sum);
    return (S - 500 * ((s / c) * oc - os)) / (cs / c) / s;
  });
  const negIndex = amounts.findIndex((vol) => vol < 0);
  if (negIndex !== -1) {
    const newParams = csPairs.filter((_, idx) => idx !== negIndex);
    const result = solveBoost(S, ...newParams);
    result.splice(negIndex, 0, 0);
    return result;
  }
  return amounts;
};

/** @param {NS} ns
 *  @param {CorpIndustryName} industryName
 *  @param {number} S
 */
export const getBoostTargets = (ns, industryName, S) => {
  const staticData = getStaticData(ns);
  /** @type {Record<CorpMaterialName, CorpMaterialConstantData>} */
  const materialData = staticData.materialData;
  /** @type {Record<CorpIndustryName, CorpIndustryData>} */
  const industryData = staticData.industryData;
  const {
    aiCoreFactor = 0,
    hardwareFactor = 0,
    realEstateFactor = 0,
    robotFactor = 0,
  } = industryData[industryName];
  const aiCoreSize = materialData['AI Cores'].size;
  const hardwareSize = materialData['Hardware'].size;
  const realEstateSize = materialData['Real Estate'].size;
  const robotSize = materialData['Robots'].size;
  const [aiCoreAmount, hardwareAmount, realEstateAmount, robotAmount] =
    solveBoost(
      S,
      [aiCoreFactor, aiCoreSize],
      [hardwareFactor, hardwareSize],
      [realEstateFactor, realEstateSize],
      [robotFactor, robotSize],
    );
  return {
    'AI Cores': Math.max(0, aiCoreAmount),
    Hardware: Math.max(0, hardwareAmount),
    'Real Estate': Math.max(0, realEstateAmount),
    Robots: Math.max(0, robotAmount),
  };
};
