import { getStaticData } from '../../lib/data-store';

/** @param {number} S
  * @param {number} c1
  * @param {number} c2
  * @param {number} c3
  * @param {number} c4
  * @param {number} s1
  * @param {number} s2
  * @param {number} s3
  * @param {number} s4
  */
export const solveBoost = (S, c1, c2, c3, c4, s1, s2, s3, s4) => {
  const c = c1+c2+c3+c4;
  const v1 = (S - 500 * (s1/c1 * (c2+c3+c4) - (s2+s3+s4))) / (c/c1);
  const v2 = (S - 500 * (s2/c2 * (c1+c3+c4) - (s1+s3+s4))) / (c/c2);
  const v3 = (S - 500 * (s3/c3 * (c1+c2+c4) - (s1+s2+s4))) / (c/c3);
  const v4 = (S - 500 * (s4/c4 * (c1+c2+c3) - (s1+s2+s3))) / (c/c4);
  return [ v1/s1, v2/s2, v3/s3, v4/s4 ];
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
    aiCoreFactor=0,
    hardwareFactor=0,
    realEstateFactor=0,
    robotFactor=0,
  } = industryData[industryName];
  const aiCoreSize = materialData['AI Cores'].size;
  const hardwareSize = materialData['Hardware'].size;
  const realEstateSize = materialData['Real Estate'].size;
  const robotSize = materialData['Robots'].size;
  const [aiCoreAmount, hardwareAmount, realEstateAmount, robotAmount] =
    solveBoost(S, aiCoreFactor, hardwareFactor, realEstateFactor, robotFactor,
      aiCoreSize, hardwareSize, realEstateSize, robotSize);
  return {
    'AI Cores': Math.max(0, aiCoreAmount),
    'Hardware': Math.max(0, hardwareAmount),
    'Real Estate': Math.max(0, realEstateAmount),
    'Robots': Math.max(0, robotAmount),
  };
};
