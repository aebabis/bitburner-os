import { main as augScoring } from './aug-scoring';
import { main as runSequencing } from './run-sequencing';

export async function main(ns: NS) {
  await augScoring(ns);
  await runSequencing(ns);
}
