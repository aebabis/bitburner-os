import { getStaticData, getPlayerData, getMoneyData } from '../lib/data-store';
import { table } from '../lib/table';
import { augValueFromStats, findOptimalBatch } from '../lib/aug-select';
import { buildFactionGoalTree } from '../lib/goals/tree';
import { getMockFormulas } from '../lib/formulas';

const NEUROFLUX = 'NeuroFlux Governor';

/** @param {NS} ns */
const getAugTableData = (ns) => {
  const {
    augmentations = /** @type {string[]} */ ([]),
    augmentationStats = /** @type {Record<string, Multipliers>} */ ({}),
    augmentationPrices = /** @type {Record<string, number>} */ ({}),
    augmentationRepReqs = /** @type {Record<string, number>} */ ({}),
    ownedAugmentations = /** @type {string[]} */ ([]),
    resetInfo = /** @type {any} */ ({}),
  } = getStaticData(ns);
  const { purchasedAugmentations = /** @type {string[]} */ ([]) } =
    getPlayerData(ns);
  const alreadyHave = new Set([
    ...ownedAugmentations,
    ...purchasedAugmentations,
  ]);
  const installedNFCount = resetInfo?.ownedAugs?.get(NEUROFLUX) ?? 0;
  return {
    augmentations,
    augmentationStats,
    augmentationPrices,
    augmentationRepReqs,
    alreadyHave,
    installedNFCount,
  };
};

/** @param {NS} ns */
export async function main(ns) {
  const [command, ...rest] = ns.args;

  if (command === undefined) {
    // TODO: Show help?
    return;
  }

  switch (command) {
    case 'aug-table': {
      const {
        augmentations,
        augmentationStats,
        augmentationPrices,
        augmentationRepReqs,
        alreadyHave,
        installedNFCount,
      } = getAugTableData(ns);

      if (Object.keys(augmentationStats).length === 0) {
        ns.tprint(
          'ERROR aug-table: augmentationStats not loaded — run the augment suite first',
        );
        break;
      }
      if (Object.keys(augmentationPrices).length === 0) {
        ns.tprint(
          'ERROR aug-table: augmentationPrices not loaded — run the augment suite first',
        );
        break;
      }

      const rows = augmentations
        .filter((aug) => aug === NEUROFLUX || !alreadyHave.has(aug))
        .map((aug) => {
          const nfMult = aug === NEUROFLUX ? 1.14 ** installedNFCount : 1;
          const value = augValueFromStats(aug, augmentationStats);
          const price = (augmentationPrices[aug] ?? 0) * nfMult;
          const repReq = (augmentationRepReqs[aug] ?? 0) * nfMult;
          return { aug, value, price, repReq };
        })
        .sort((a, b) => b.value - a.value);

      const fmt = /** @param {string | number} x */ (x) =>
        ns.format.number(/** @type {number} */ (x), 3);
      ns.tprint(
        '\n' +
          table(
            ns,
            [
              'Augmentation',
              { name: 'Value', align: 'right', process: fmt },
              { name: 'Price', align: 'right', process: fmt },
              { name: 'Rep Req', align: 'right', process: fmt },
            ],
            rows.map(({ aug, value, price, repReq }) => [
              aug,
              value,
              price,
              repReq,
            ]),
          ),
      );
      break;
    }
    case 'aug-live': {
      ns.disableLog('ALL');
      ns.ui.openTail();
      while (true) {
        const {
          augmentations,
          augmentationStats,
          augmentationPrices,
          augmentationRepReqs,
          alreadyHave,
          installedNFCount,
        } = getAugTableData(ns);
        const { referenceIncome = 0 } = getMoneyData(ns);
        const {
          player: augLivePlayer,
          factionRep = /** @type {Record<string, number>} */ ({}),
        } = getPlayerData(ns);

        const {
          factionAugmentations = /** @type {Record<string, string[]>} */ ({}),
          factionFavor:
            augLiveFactionFavor = /** @type {Record<string, number>} */ ({}),
        } = getStaticData(ns);
        const augLiveFormulas = ns.fileExists('Formulas.exe', 'home')
          ? ns.formulas
          : getMockFormulas({ installedAugmentations: [] });
        const augFactions = /** @type {Record<string, string[]>} */ ({});
        for (const [faction, augs] of Object.entries(factionAugmentations))
          for (const aug of augs) (augFactions[aug] ??= []).push(faction);

        const rows = augmentations
          .filter((aug) => aug === NEUROFLUX || !alreadyHave.has(aug))
          .map((aug) => {
            const nfMult = aug === NEUROFLUX ? 1.14 ** installedNFCount : 1;
            const value = augValueFromStats(aug, augmentationStats);
            const price = (augmentationPrices[aug] ?? 0) * nfMult;
            const repReq = (augmentationRepReqs[aug] ?? 0) * nfMult;
            const factions = augFactions[aug] ?? [];
            const bestRepRate = Math.max(
              0,
              ...(augLivePlayer.factions ?? []).map(
                (f) =>
                  (augLiveFormulas.work.factionGains(
                    augLivePlayer,
                    'hacking',
                    augLiveFactionFavor[f],
                  )?.reputation ?? 0) * 5,
              ),
            );
            const bestCurrentRep = Math.max(
              0,
              ...factions.map((f) => factionRep[f] ?? 1),
            );
            const remainingRep = Math.max(0, repReq - bestCurrentRep);
            const timeForMoney =
              referenceIncome > 0 ? price / referenceIncome : Infinity;
            const timeForRep =
              bestRepRate > 0
                ? remainingRep / bestRepRate
                : remainingRep > 0
                  ? Infinity
                  : 0;
            const time = Math.max(timeForMoney, timeForRep);
            const utility =
              value > 0 && isFinite(time) && time > 0 ? value / time : 0;
            return { aug, value, utility };
          })
          .sort((a, b) => b.utility - a.utility);

        const fmt = /** @param {string | number} x */ (x) =>
          ns.format.number(/** @type {number} */ (x), 3);
        ns.clearLog();
        ns.print(
          table(
            ns,
            [
              'Augmentation',
              { name: 'Value', align: 'right', process: fmt },
              {
                name: 'Utility×1M',
                align: 'right',
                process: /** @param {string | number} x */ (x) =>
                  fmt(/** @type {number} */ (x) * 1e6),
              },
            ],
            rows.map(({ aug, value, utility }) => [aug, value, utility]),
          ),
        );

        await ns.sleep(2000);
      }
    }
    case 'faction-live': {
      ns.disableLog('ALL');
      ns.ui.openTail();
      /** @param {number | null} s */
      const fmtTime = (s) => {
        if (s == null || !isFinite(s)) return '?';
        if (s === 0) return '';
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        return [h, m, sec].join(':').replace(/^0:/, '').replace(/^0:/, '');
      };
      while (true) {
        const staticData = getStaticData(ns);
        const { augmentationStats = {} } = staticData;
        const {
          player,
          factionRep = {},
          purchasedAugmentations = [],
        } = getPlayerData(ns);
        const { referenceIncome = 0 } = getMoneyData(ns);
        const formulas = ns.fileExists('Formulas.exe', 'home')
          ? ns.formulas
          : getMockFormulas(staticData);
        const ownedAugs = [
          ...(staticData.ownedAugmentations ?? []),
          ...purchasedAugmentations,
        ];
        const moneyRate = referenceIncome || Infinity;
        const planData = {
          player,
          staticData,
          factionRep,
          purchasedAugmentations,
          ownedAugs,
          money: player.money ?? 0,
          referenceIncome,
          formulas,
          karma: ns.heart.break(),
        };

        const rows = (player.factions ?? [])
          .map((faction) => {
            const { utility, batch } = findOptimalBatch(
              faction,
              staticData,
              player,
              formulas,
              factionRep,
              ownedAugs,
              { moneyRate },
            );
            const nfCount = batch.filter((a) => a === NEUROFLUX).length;
            const nonNfCount = batch.length - nfCount;
            const value = batch.reduce(
              (sum, aug) => sum + augValueFromStats(aug, augmentationStats),
              0,
            );
            const tree = buildFactionGoalTree(faction, planData);
            const times = tree?.terminalGoals.map((g) => g.timeToComplete());
            const eta =
              times == null || times.some((t) => t == null)
                ? null
                : Math.max(.../** @type {number[]} */ (times));
            return [faction, value, utility, nfCount, nonNfCount, eta];
          })
          .sort(
            (a, b) =>
              /** @type {number} */ (b[2]) - /** @type {number} */ (a[2]),
          );

        const fmt = /** @param {string | number} x */ (x) =>
          ns.format.number(/** @type {number} */ (x), 3);
        ns.clearLog();
        ns.print(
          table(
            ns,
            [
              'Faction',
              { name: 'Value', align: 'right', process: fmt },
              {
                name: 'Util×1M',
                align: 'right',
                process: /** @param {string | number} x */ (x) =>
                  fmt(/** @type {number} */ (x) * 1e6),
              },
              { name: 'NF', align: 'right' },
              { name: 'Augs', align: 'right' },
              {
                name: 'ETA',
                align: 'right',
                process: /** @param {string | number} x */ (x) =>
                  fmtTime(/** @type {number} */ (x)),
              },
            ],
            rows,
          ),
        );
        await ns.sleep(2000);
      }
    }
    default:
      ns.tprint('Commands: aug-table | aug-live | faction-live');
  }
}
