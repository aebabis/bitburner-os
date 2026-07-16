import { setupRunner, assert } from '../test-runner';
import { staticData } from './data/BN4-mock';
import {
  getAccessibleFactions,
  findOptimalBatch,
  computeResetOverhead,
  MAX_AUGS,
} from '../aug-select';
import { formulas as getFormulas } from '../formulas';
import { buildPerson } from './fixtures';

// Realistic early BN4 rates: modest hacking income, typical faction work rep gain.
// These are intentionally conservative so the test reflects a plausible worst-case.
// hacking=585 → factionGains.reputation = 585/975 = 0.6, effectiveRepRate = 0.6*5 = 3
const MONEY_RATE = 10e3;
const NEUROFLUX = 'NeuroFlux Governor';

export async function main(ns: NS) {
  const { describe, it, runSuite } = setupRunner(ns);

  const select = (
    ns: NS,
    owned: string[],
    factionRep: Record<string, number> = {},
    moneyRate = MONEY_RATE,
  ) => {
    const numNeuroflux = owned.filter((aug) => aug === NEUROFLUX).length;
    const data = structuredClone(staticData);
    data.augmentationRepReqs[NEUROFLUX] *= 1.14 ** numNeuroflux;
    data.augmentationPrices[NEUROFLUX] *= 1.14 ** numNeuroflux;

    const base = buildPerson(data as any);
    const player = {
      ...base,
      skills: { ...base.skills, hacking: 585 },
      factions: [] as FactionName[],
    } as any;
    const formulas = getFormulas(ns, data as any);
    const batchOpts = { moneyRate };
    const overhead = computeResetOverhead(data as any);
    const stillNeeds = (aug: string) => !owned.includes(aug);

    let bestFaction: FactionName | null = null,
      bestUtility = -Infinity;
    for (const faction of getAccessibleFactions(data as any, player, owned)) {
      const faugs: string[] = (data.factionAugmentations as any)[faction] ?? [];
      if (!faugs.includes(NEUROFLUX) && faugs.filter(stillNeeds).length === 0) continue;
      const { utility } = findOptimalBatch(
        faction,
        data as any,
        player,
        formulas as any,
        factionRep,
        owned,
        overhead,
        batchOpts,
      );
      if (utility > bestUtility) {
        bestFaction = faction;
        bestUtility = utility;
      }
    }
    if (!bestFaction) return { faction: null, augmentations: [] as string[] };

    const { batch }: { batch: string[] } = findOptimalBatch(
      bestFaction,
      data as any,
      player,
      formulas as any,
      factionRep,
      owned,
      overhead,
      batchOpts,
    );
    const augmentationPrices = data.augmentationPrices as Record<string, number>;
    const { augmentationPrereqs } = data;
    const nfCount = batch.filter((a) => a === NEUROFLUX).length;
    const unique: string[] = batch
      .filter((a) => a !== NEUROFLUX)
      .sort((a, b) => (augmentationPrices[b] ?? 0) - (augmentationPrices[a] ?? 0));
    const order = new Set<string>();
    for (const aug of unique) {
      for (const prereq of ((augmentationPrereqs as Record<string, string[]>)[aug] ?? [])
        .filter(stillNeeds)
        .reverse())
        order.add(prereq);
      order.add(aug);
    }
    return {
      faction: bestFaction,
      augmentations: [...order, ...Array(nfCount).fill(NEUROFLUX)].slice(0, MAX_AUGS),
    };
  };

  describe('selectAugmentations', () => {
    describe('BN4 run', () => {
      describe('Aug 1', () => {
        it.skip('should skip Netburners?', () => {
          const { faction } = select(ns, []);
          assert.notEqual(faction, 'Netburners');
        });

        it('should select more than 1 augmentation', () => {
          const { augmentations } = select(ns, []);
          assert(augmentations.length > 1, `${augmentations.length} augs selected`);
        });
      });

      describe('Aug 2', () => {
        it('should select more than 1 augmentation', () => {
          const aug1 = select(ns, []);
          const aug2 = select(ns, aug1.augmentations);
          assert(aug2.augmentations.length > 1, `${aug2.augmentations.length} augs selected`);
        });
      });

      it('should eventually buy DataJack', () => {
        let runNum = 0;
        let augsObtained: string[] = [];
        while (true) {
          const moneyRate = 10 * 10 ** runNum;
          const aug = select(ns, augsObtained, {}, moneyRate);
          console.log(aug.faction);
          console.log(aug.augmentations.join('\n') + '\n');
          augsObtained = [...augsObtained, ...aug.augmentations];
          runNum++;
          if (aug.augmentations.includes('DataJack')) {
            const uniqueLeft = (staticData as any).augmentations.filter(
              (a: string) => a !== 'NeuroFlux Governor',
            );
            console.log('Got to DataJack with ' + uniqueLeft.length + ' augs to buy');
            // QLink and The Red Pill require endgame factions whose cost is dominated by
            // training overhead when player skills are empty. A realistic test needs a
            // player whose stats grow with each run.
            // TODO: add an endgame test with progressive player skills.
            break;
          } else if (runNum === 100) {
            throw new Error('Took too long');
          }
        }
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Deferred / backlog
  // ---------------------------------------------------------------------------
  // TODO: Player has manually grinded 450k rep in a city faction but only needs
  //       one aug — verify BUY_REP path is preferred over grinding (Phase 3).
  //
  // TODO: Faction with a prereq chain — verify getPurchaseOrder includes prereqs
  //       and the total list stays within MAX_AUGS.
  //
  // TODO: All augs from a faction are owned — verify that faction's utility is 0
  //       and the next-best faction is selected.
  //
  // TODO: timeToComplete should be a method on each Goal rather than a standalone
  //       recursive function — move it into the goal factory so each node owns its
  //       own memoized traversal.

  await runSuite();
}
