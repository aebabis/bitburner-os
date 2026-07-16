import { main as augScoring } from './aug-scoring';
import { main as runSequencing } from './run-sequencing';
import { main as formulas } from './formulas';
import { main as factionSelection } from './faction-selection';
import { main as goalTree } from './goal-tree';

export async function main(ns: NS) {
  await augScoring(ns);
  await runSequencing(ns);
  await formulas(ns);
  await factionSelection(ns);
  await goalTree(ns);
}
