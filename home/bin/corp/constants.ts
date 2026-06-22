export const CORP_NAME = 'Rhizome Industries';
export const BOOST_MATERIALS = ['AI Cores', 'Hardware', 'Real Estate', 'Robots'] as const;

export const DivisionNames: Record<CorpIndustryName, string> = {
  Agriculture: 'Rhizome Foods',
  Chemical: 'Rhizome Derivatives',
  'Computer Hardware': 'Rhizome Semiconductor',
  'Real Estate': 'Rhizome Property Management Ltd.',
  Fishing: 'Rhizome Shores',
  Healthcare: 'Rhizen Health',
  Mining: 'Rhizome Excavation',
  Pharmaceutical: 'Rhizome Pharmaceuticals',
  Refinery: 'Rhizome Processing',
  Restaurant: 'Rhizome Family Eatery',
  Robotics: 'Rhizome Robotics',
  Software: 'Rhizome Visions',
  Tobacco: 'Rhizome Reeds',
  'Water Utilities': 'Taproot Infrastructure',
} as const;

type valueof<T> = T[keyof T];
export type DivisionName = valueof<typeof DivisionNames>;
