const win = globalThis;

const HISTORY_MS = 10 * 60 * 1000;

/** @typedef {{frameId: string, jobIds: string[], scheduledStart: number}} Frame */
/** @typedef {{jobId: string, frameId: string, server: string, type: string, threads: number, scheduledStart: number, scheduledEnd: number, actualStart: number | null, actualEnd: number | null, result: unknown}} Job */
/** @typedef {{jobs: Map<string, Job>, frameIds: Set<string>, frames: Frame[]}} ProfilerState */

/** @param {ProfilerState} p */
const evict = (p) => {
  const cutoff = Date.now() - HISTORY_MS;
  while (p.frames.length > 1 && p.frames[0].scheduledStart < cutoff) {
    const evicted = p.frames.shift();
    if (evicted != null) {
      p.frameIds.delete(evicted.frameId);
      for (const id of evicted.jobIds) p.jobs.delete(id);
    }
  }
};

/** @param {ProfilerState} p */
const makeRecordScheduled =
  (p) => (/** @type {string} */ frameId, /** @type {string} */ jobId, /** @type {string} */ server, /** @type {string} */ type, /** @type {number} */ threads, /** @type {number} */ start, /** @type {number} */ end) => {
    if (!p.frameIds.has(frameId)) {
      p.frameIds.add(frameId);
      p.frames.push({ frameId, jobIds: [], scheduledStart: start });
      evict(p);
    }
    p.frames[p.frames.length - 1].jobIds.push(jobId);
    p.jobs.set(jobId, {
      jobId,
      frameId,
      server,
      type,
      threads,
      scheduledStart: start,
      scheduledEnd: end,
      actualStart: null,
      actualEnd: null,
      result: null,
    });
  };

/** @param {ProfilerState} p */
const makeRecordStart = (p) => (/** @type {string} */ jobId, /** @type {number} */ actualStart) => {
  const job = p.jobs.get(jobId);
  if (job) job.actualStart = actualStart;
};

/** @param {ProfilerState} p */
const makeRecordActual = (p) => (/** @type {string} */ jobId, /** @type {number} */ actualStart, /** @type {number} */ actualEnd, /** @type {unknown} */ result) => {
  const job = p.jobs.get(jobId);
  if (job) {
    job.actualStart = actualStart;
    job.actualEnd = actualEnd;
    job.result = result;
  }
};

/** @param {ProfilerState} p */
const makeRecordReaped = (p) => (/** @type {string} */ jobId) => {
  const job = p.jobs.get(jobId);
  if (!job) return;
  p.jobs.delete(jobId);
  const frame = p.frames.find((f) => f.frameId === job.frameId);
  if (frame) {
    const idx = frame.jobIds.indexOf(jobId);
    if (idx !== -1) frame.jobIds.splice(idx, 1);
  }
};

/** @type {ProfilerState | null} */
let _profilerState = null;

export const initProfiler = () => {
  const p = /** @type {ProfilerState} */ ({
    jobs: new Map(),
    frameIds: new Set(),
    frames: [],
  });
  _profilerState = p;
  win.__profiler = {
    recordScheduled: makeRecordScheduled(p),
    recordStart: makeRecordStart(p),
    recordActual: makeRecordActual(p),
    recordReaped: makeRecordReaped(p),
  };
};

export const getSnapshot = () => {
  const p = _profilerState;
  if (!p) return null;
  return p.frames.map(({ frameId, jobIds }) => ({
    frameId,
    jobs: /** @type {Job[]} */ (jobIds.map((/** @type {string} */ id) => p.jobs.get(id)).filter(Boolean)),
  }));
};
