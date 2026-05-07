const win = globalThis;

const HISTORY_MS = 10 * 60 * 1000;

const evict = (p) => {
  const cutoff = Date.now() - HISTORY_MS;
  while (p.frames.length > 1 && p.frames[0].scheduledStart < cutoff) {
    const evicted = p.frames.shift();
    p.frameIds.delete(evicted.frameId);
    for (const id of evicted.jobIds) p.jobs.delete(id);
  }
};

const makeRecordScheduled =
  (p) => (frameId, jobId, server, type, threads, start, end) => {
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

const makeRecordStart = (p) => (jobId, actualStart) => {
  const job = p.jobs.get(jobId);
  if (job) job.actualStart = actualStart;
};

const makeRecordActual = (p) => (jobId, actualStart, actualEnd, result) => {
  const job = p.jobs.get(jobId);
  if (job) {
    job.actualStart = actualStart;
    job.actualEnd = actualEnd;
    job.result = result;
  }
};

const makeRecordReaped = (p) => (jobId) => {
  const job = p.jobs.get(jobId);
  if (!job) return;
  p.jobs.delete(jobId);
  const frame = p.frames.find((f) => f.frameId === job.frameId);
  if (frame) {
    const idx = frame.jobIds.indexOf(jobId);
    if (idx !== -1) frame.jobIds.splice(idx, 1);
  }
};

export const initProfiler = () => {
  const p = { jobs: new Map(), frameIds: new Set(), frames: [] };
  p.recordScheduled = makeRecordScheduled(p);
  p.recordStart = makeRecordStart(p);
  p.recordActual = makeRecordActual(p);
  p.recordReaped = makeRecordReaped(p);
  win.__profiler = p;
};

export const getSnapshot = () => {
  const p = win.__profiler;
  if (!p) return null;
  return p.frames.map(({ frameId, jobIds }) => ({
    frameId,
    jobs: jobIds.map((id) => p.jobs.get(id)).filter(Boolean),
  }));
};
