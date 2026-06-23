const sum = (a: number, b: number) => a + b;

const solveBoost = (S: number, ...csPairs: [number, number][]): number[] => {
  const cs = csPairs.map(([c]) => c).reduce(sum, 0);
  const amounts = csPairs.map(([c, s], i) => {
    const others = csPairs.filter((_, idx) => idx !== i);
    const oc = others.map(([c]) => c).reduce(sum, 0);
    const os = others.map(([, s]) => s).reduce(sum, 0);
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

export const getBoostTargets = (
  materialData: Record<CorpMaterialName, CorpMaterialConstantData>,
  industryData: Record<CorpIndustryName, CorpIndustryData>,
  industryName: CorpIndustryName,
  S: number,
) => {
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
  const [aiCoreAmount, hardwareAmount, realEstateAmount, robotAmount] = solveBoost(
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
