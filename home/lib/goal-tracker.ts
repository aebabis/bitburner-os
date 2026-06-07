import { Plan } from './goals/nodes';

const win = globalThis;

const HISTORY_MS = 10 * 60 * 1000;
const MAX_SNAPSHOTS = 600;
const MIN_INTERVAL_MS = Math.floor(HISTORY_MS / MAX_SNAPSHOTS); // 1s — keeps buffer spanning the full history window

type GoalPlanEntry = {
  faction: string;
  utility: number;
  timeToComplete: number | null;
};
type GoalSnapshot = {
  ts: number;
  selectedFaction: string | null;
  plans: GoalPlanEntry[];
};

declare global {
  var __goalTracker: {
    snapshots: GoalSnapshot[];
  };
}
export {};

const getState = () => {
  if (!win.__goalTracker) win.__goalTracker = { snapshots: [] };
  return win.__goalTracker;
};

export const recordGoalSnapshot = (
  plans: Plan[],
  selectedFaction: FactionName | null,
  overhead: number,
) => {
  const state = getState();
  const ts = Date.now();
  const last = state.snapshots[state.snapshots.length - 1];
  if (last && ts - last.ts < MIN_INTERVAL_MS) return;
  const cutoff = ts - HISTORY_MS;
  state.snapshots.push({
    ts,
    selectedFaction,
    plans: plans.map((p) => {
      const ttcValues = p.deps.map((g) => g.timeToComplete());
      return {
        faction: p.prerequisites('FACTION_JOIN')[0]?.faction ?? '?',
        utility: p.utility(overhead),
        timeToComplete:
          ttcValues.length === 0
            ? 0
            : ttcValues.some((t) => t == null || !isFinite(t))
              ? null
              : Math.max(...(ttcValues as number[])),
      };
    }),
  });
  while (
    state.snapshots.length > MAX_SNAPSHOTS ||
    (state.snapshots.length > 1 && state.snapshots[0].ts < cutoff)
  )
    state.snapshots.shift();
};

export const getGoalSnapshot = () => win.__goalTracker?.snapshots ?? [];
