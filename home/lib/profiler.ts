const win = globalThis;

const HISTORY_MS = 10 * 60 * 1000;

type Frame = {
  frameId: string;
  jobIds: string[];
  scheduledStart: number;
};
type Job = {
  jobId: string;
  frameId: string;
  server: string;
  type: string;
  threads: number;
  scheduledStart: number;
  scheduledEnd: number;
  actualStart: number | null;
  actualEnd: number | null;
  result: unknown;
};
type ProfilerState = {
  jobs: Map<string, Job>;
  frameIds: Set<string>;
  frames: Frame[];
};

const evict = (p: ProfilerState) => {
  const cutoff = Date.now() - HISTORY_MS;
  while (p.frames.length > 1 && p.frames[0].scheduledStart < cutoff) {
    const evicted = p.frames.shift();
    if (evicted != null) {
      p.frameIds.delete(evicted.frameId);
      for (const id of evicted.jobIds) p.jobs.delete(id);
    }
  }
};

const makeRecordScheduled =
  (p: ProfilerState) =>
  (
    frameId: string,
    jobId: string,
    server: string,
    type: string,
    threads: number,
    start: number,
    end: number,
  ) => {
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

const makeRecordStart =
  (p: ProfilerState) => (jobId: string, actualStart: number) => {
    const job = p.jobs.get(jobId);
    if (job) job.actualStart = actualStart;
  };

const makeRecordActual =
  (p: ProfilerState) =>
  (jobId: string, actualStart: number, actualEnd: number, result: number) => {
    const job = p.jobs.get(jobId);
    if (job) {
      job.actualStart = actualStart;
      job.actualEnd = actualEnd;
      job.result = result;
    }
  };

const makeRecordReaped = (p: ProfilerState) => (jobId: string) => {
  const job = p.jobs.get(jobId);
  if (!job) return;
  p.jobs.delete(jobId);
  const frame = p.frames.find((f) => f.frameId === job.frameId);
  if (frame) {
    const idx = frame.jobIds.indexOf(jobId);
    if (idx !== -1) frame.jobIds.splice(idx, 1);
  }
};

type Profiler = {
  recordScheduled: ReturnType<typeof makeRecordScheduled>;
  recordStart: ReturnType<typeof makeRecordStart>;
  recordActual: ReturnType<typeof makeRecordActual>;
  recordReaped: ReturnType<typeof makeRecordReaped>;
};
let _profilerState: ProfilerState | null = null;
declare global {
  var __profiler: Profiler;
}
export {};

export const initProfiler = () => {
  if (_profilerState != null) return;
  const p: ProfilerState = {
    jobs: new Map(),
    frameIds: new Set(),
    frames: [],
  };
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
    jobs: jobIds.map((id: string) => p.jobs.get(id)).filter(Boolean),
  }));
};
