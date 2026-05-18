import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { staticData } from './data/BN4-mock.js';
import { selectAugmentations } from '../home/lib/aug-select.js';

// Realistic early BN4 rates: modest hacking income, typical faction work rep gain.
// These are intentionally conservative so the test reflects a plausible worst-case.
const RATES = { moneyRate: 10e3, repRate: 3 };

const select = (owned, factionRep = {}, moneyRate = RATES.moneyRate) =>
  selectAugmentations(owned, staticData, {skills:{}, factions:[]}, undefined, factionRep, 
    { ... RATES, moneyRate });

describe('selectAugmentations', () => {
  describe('BN4 run', () => {
    describe('Aug 1', () => {
      it.skip('should skip Netburners?', () => {
        const { faction } = select([]);
        assert.notEqual(faction, 'Netburners');
      });

      it('should select more than 1 augmentation', () => {
        const { augmentations } = select([]);
        assert(augmentations.length > 1, `${augmentations.length} augs selected`);
      });
    });

    describe('Aug 2', () => {
      it('should select more than 1 augmentation', () => {
        const aug1 = select([]);
        const aug2 = select(aug1.augmentations);
        assert(aug2.augmentations.length > 1, `${aug2.augmentations.length} augs selected`);
      });
    });

    it('should end eventually', () => {
      let run = 0;
      let augsObtained = [];
      while (true) {
        const moneyRate = 10 * (10 ** run);
        const aug = select(augsObtained, {}, moneyRate);
        augsObtained = [...augsObtained, ...aug.augmentations];
        run++;
        if (aug.augmentations.length === 0) {
          console.log('Finished in ' + run + ' runs');
          assert(augsObtained.includes('QLink'));
          assert(augsObtained.includes('The Red Pill'));
          break;
        } else if (run === 100) {
          throw new Error('Took too long');
        }
        console.log(aug.faction);
        console.log(aug.augmentations.join('\n')+'\n');
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
