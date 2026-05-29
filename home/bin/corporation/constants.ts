/** @type {('AI Cores'|'Hardware'|'Real Estate'|'Robots')[]} */
export const BOOST_MATERIALS = [
  'AI Cores',
  'Hardware',
  'Real Estate',
  'Robots',
];

export const DivisionNames: Record<CorpIndustryName, string> = {
  Agriculture: 'Rhizome Foods',
  Chemical: 'Rhizome Derivatives',
  Tobacco: 'Rhizome Reeds',
  'Water Utilities': 'Taproot Infrastructure',
} as const;

type valueof<T> = T[keyof T];
export type DivisionName = valueof<DivisionNames>;
