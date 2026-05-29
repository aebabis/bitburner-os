const win = globalThis;

const HISTORY_MS = 10 * 60 * 1000;
const MAX_SNAPSHOTS = 600;
const MIN_INTERVAL_MS = Math.floor(HISTORY_MS / MAX_SNAPSHOTS); // 1s — keeps buffer spanning the full history window

/**
 * @typedef {{ faction: string, utility: number, value: number, timeToComplete: number | null }} GoalPlanEntry
 * @typedef {{ ts: number, selectedFaction: string | null, plans: GoalPlanEntry[] }} GoalSnapshot
 */

const getState = () => {
  if (!win.__goalTracker) win.__goalTracker = { snapshots: /** @type {GoalSnapshot[]} */ ([]) };
  return /** @type {{ snapshots: GoalSnapshot[] }} */ (win.__goalTracker);
};

/**
 * @param {{ goals: import('./goals/nodes.js').Goal[], terminalGoals: import('./goals/nodes.js').Goal[], value: number, utility: (overhead: number) => number }[]} plans
 * @param {string | null} selectedFaction
 * @param {number} overhead
 */
export const recordGoalSnapshot = (plans, selectedFaction, overhead) => {
  const state = getState();
  const ts = Date.now();
  const last = state.snapshots[state.snapshots.length - 1];
  if (last && ts - last.ts < MIN_INTERVAL_MS) return;
  const cutoff = ts - HISTORY_MS;
  state.snapshots.push({
    ts,
    selectedFaction,
    plans: plans.map((p) => {
      const ttcValues = p.terminalGoals.map((g) => g.timeToComplete());
      return {
        faction: p.goals.find((g) => g.type === 'FACTION_JOIN')?.faction ?? '?',
        utility: p.utility(overhead),
        value: p.value,
        timeToComplete: ttcValues.some((t) => t == null || !isFinite(/** @type {any} */ (t)))
          ? null
          : Math.max(.../** @type {number[]} */ (ttcValues)),
      };
    }),
  });
  while (
    state.snapshots.length > MAX_SNAPSHOTS ||
    (state.snapshots.length > 1 && state.snapshots[0].ts < cutoff)
  )
    state.snapshots.shift();
};

/** @returns {GoalSnapshot[]} */
export const getGoalSnapshot = () =>
  /** @type {any} */ (win.__goalTracker)?.snapshots ?? [];
