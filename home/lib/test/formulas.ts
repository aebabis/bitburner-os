import { setupRunner } from '../test-runner';
import { getMockFormulas, hasFormulas } from '../formulas';
import { getStaticData } from '../data-store';

// This suite exists to catch drift between getMockFormulas and the real ns.formulas API.
// It always compares against the real API rather than falling back to a mock-only sanity
// check -- a suite that can silently degrade to testing the mock against itself would stop
// being a meaningful accuracy baseline. Acquire Formulas.exe to run this suite.
export async function main(ns: NS) {
  const { describe, it, assert, runSuite } = setupRunner(ns);

  if (!hasFormulas(ns)) {
    ns.tprint('ERROR Acquire Formulas.exe to run this suite.');
    return;
  }

  const staticData = getStaticData(ns);
  const player = ns.getPlayer();
  // Query live rather than reading cached PlayerData -- this suite cares about exactness at the
  // moment it runs, not the RAM cost tradeoff that makes production callers prefer the cache.
  const mock = getMockFormulas(staticData, {
    sharePower: ns.getSharePower(),
    studyMult: ns.hacknet.getStudyMult(),
    trainingMult: ns.hacknet.getTrainingMult(),
  });
  const real = ns.formulas;

  const describeDiff = (context: string, actual: number, expected: number) =>
    `${context}: expected ${expected}, got ${actual}`;

  const assertClose = (actual: number, expected: number, context: string) =>
    assert.close(actual, expected, 1e-6, describeDiff(context, actual, expected));

  const assertEqual = (actual: number, expected: number, context: string) =>
    assert.equal(actual, expected, describeDiff(context, actual, expected));

  const compareWorkStats = (
    actual: ReturnType<typeof real.work.factionGains>,
    expected: ReturnType<typeof real.work.factionGains>,
    context: string,
    notes: Partial<Record<keyof typeof expected, string>> = {},
  ) => {
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      const note = notes[key];
      assertClose(
        actual[key] ?? 0,
        expected[key] ?? 0,
        note ? `${context}: ${key} (${note})` : `${context}: ${key}`,
      );
    }
  };

  // backdoorDiscount (formulas.ts) infers "backdoored" from hacking level alone, which is wrong
  // right after an aug/BN reset: the level bar is trivially cleared again but the player hasn't
  // had time to re-backdoor low-priority servers like gyms/universities. A money mismatch here
  // shortly after a reset is this known gap, not necessarily a new regression.
  const BACKDOOR_NOTE =
    'expected to occasionally disagree just after an aug/BN reset -- see backdoorDiscount in formulas.ts';

  describe('mock formulas vs real ns.formulas', () => {
    describe('skills', () => {
      it('calculateSkill matches for a range of exp values', () => {
        for (const exp of [0, 100, 1e4, 1e6, 1e8]) {
          assertEqual(
            mock.skills.calculateSkill(exp),
            real.skills.calculateSkill(exp),
            `exp=${exp}`,
          );
        }
      });

      it('calculateExp matches for a range of skill values', () => {
        for (const skill of [1, 50, 500, 2000]) {
          assertClose(
            mock.skills.calculateExp(skill),
            real.skills.calculateExp(skill),
            `skill=${skill}`,
          );
        }
      });
    });

    describe('reputation', () => {
      it('calculateFavorToRep matches for a range of favor values', () => {
        for (const favor of [0, 10, 100, 150]) {
          assertClose(
            mock.reputation.calculateFavorToRep(favor),
            real.reputation.calculateFavorToRep(favor),
            `favor=${favor}`,
          );
        }
      });

      it('calculateRepToFavor matches for a range of rep values', () => {
        for (const rep of [0, 25000, 1e6, 1e9]) {
          assertClose(
            mock.reputation.calculateRepToFavor(rep),
            real.reputation.calculateRepToFavor(rep),
            `rep=${rep}`,
          );
        }
      });

      it('donationForRep matches for the live player', () => {
        assertClose(
          mock.reputation.donationForRep(1000, player),
          real.reputation.donationForRep(1000, player),
          'donationForRep',
        );
      });

      it('repFromDonation matches for the live player', () => {
        assertClose(
          mock.reputation.repFromDonation(1e6, player),
          real.reputation.repFromDonation(1e6, player),
          'repFromDonation',
        );
      });
    });

    describe('hacking', () => {
      for (const hostname of ['n00dles', 'foodnstuff']) {
        const server = ns.getServer(hostname);

        it(`hackExp matches for ${hostname}`, () => {
          assertClose(
            mock.hacking.hackExp(server, player),
            real.hacking.hackExp(server, player),
            hostname,
          );
        });

        it(`hackTime matches for ${hostname}`, () => {
          assertClose(
            mock.hacking.hackTime(server, player),
            real.hacking.hackTime(server, player),
            hostname,
          );
        });
      }
    });

    describe('work.factionGains', () => {
      for (const workType of ['hacking', 'field', 'security'] as const) {
        for (const favor of [0, 50]) {
          it(`${workType} gains match at favor=${favor}`, () => {
            compareWorkStats(
              mock.work.factionGains(player, workType, favor),
              real.work.factionGains(player, workType, favor),
              `workType=${workType} favor=${favor}`,
            );
          });
        }
      }
    });

    describe('work.gymGains', () => {
      for (const gymType of ['str', 'def', 'dex', 'agi'] as const) {
        it(`${gymType} gains match at Iron Gym`, () => {
          compareWorkStats(
            mock.work.gymGains(player, gymType, 'Iron Gym'),
            real.work.gymGains(player, gymType, 'Iron Gym'),
            `gymType=${gymType}`,
            { money: BACKDOOR_NOTE },
          );
        });
      }
    });

    describe('work.universityGains', () => {
      for (const classType of ['Computer Science', 'Algorithms', 'Leadership'] as const) {
        it(`${classType} gains match at Rothman University`, () => {
          compareWorkStats(
            mock.work.universityGains(player, classType, 'Rothman University'),
            real.work.universityGains(player, classType, 'Rothman University'),
            `classType=${classType}`,
            { money: BACKDOOR_NOTE },
          );
        });
      }
    });

    describe('hacknetNodes', () => {
      it('moneyGainRate matches for a representative node', () => {
        const prodMult = staticData.hacknetMultipliers?.production ?? 1;
        assertClose(
          mock.hacknetNodes.moneyGainRate(5, 4, 2),
          real.hacknetNodes.moneyGainRate(5, 4, 2, prodMult),
          'moneyGainRate',
        );
      });
    });
  });

  await runSuite();
}
