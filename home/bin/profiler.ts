import { getTailModal } from '../lib/modal';
import { getSnapshot } from '../lib/profiler';

const doc = eval('document');
const win = eval('window');

const COLORS = /** @type {Record<string, string>} */ {
  H: '#e5c07b',
  W1: '#56b6c2',
  G: '#98c379',
  W2: '#61afef',
};
const TYPES = ['H', 'W1', 'G', 'W2'];
const AXIS_H = 22;
const LABEL_W = 28;
const LANE_H = 20;
const LANE_GAP = 4;
const STRIPE_H = 16;
const VIEW_MS = 10_000;
const DOT_SIZE = 3;
const PANEL_GAP = 6;
const STATS_LINE_H = 14;
const STATS_ROWS = 3;
const DRIFT_STATS_H = STATS_ROWS * STATS_LINE_H + 6;

const TIMELINE_H = AXIS_H + TYPES.length * (LANE_H + LANE_GAP);

// -- Shared panel helpers --

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {(t: number) => number} toX
 * @param {{y: number, w: number}} bounds
 * @param {number} now
 * @param {number} tMin
 * @param {number} tMax
 */
const drawTimeAxis = (ctx, toX, bounds, now, tMin, tMax) => {
  ctx.fillStyle = '#222';
  ctx.fillRect(LABEL_W, bounds.y, bounds.w - LABEL_W, AXIS_H);
  ctx.font = '9px monospace';
  ctx.textBaseline = 'alphabetic';
  const tRange = tMax - tMin;
  const tickStep = Math.ceil(tRange / 6 / 1000) * 1000;
  for (
    let t = Math.ceil(tMin / tickStep) * tickStep;
    t <= tMax;
    t += tickStep
  ) {
    const x = Math.round(toX(t));
    if (x < LABEL_W) continue;
    ctx.fillStyle = '#444';
    ctx.fillRect(x, bounds.y + AXIS_H - 4, 1, 4);
    ctx.fillStyle = '#666';
    const offsetS = ((t - now) / 1000).toFixed(0);
    ctx.fillText(
      `${+offsetS >= 0 ? '+' : ''}${offsetS}s`,
      x + 2,
      bounds.y + AXIS_H - 6,
    );
  }
};

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {(t: number) => number} toX
 * @param {number} now
 * @param {{y: number, h: number}} bounds
 */
const drawNowLine = (ctx, toX, now, bounds) => {
  const nowX = Math.round(toX(now));
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(nowX, bounds.y);
  ctx.lineTo(nowX, bounds.y + bounds.h);
  ctx.stroke();
  ctx.setLineDash([]);
};

// -- Timeline panel --

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {NonNullable<ReturnType<typeof getSnapshot>>} snapshot
 * @param {(t: number) => number} toX
 * @param {{y: number, w: number, h: number}} bounds
 * @param {number} now
 * @param {number} tMin
 * @param {number} tMax
 */
const drawTimeline = (ctx, snapshot, toX, bounds, now, tMin, tMax) => {
  drawTimeAxis(ctx, toX, bounds, now, tMin, tMax);
  drawNowLine(ctx, toX, now, { y: bounds.y + AXIS_H, h: bounds.h - AXIS_H });

  const allJobs = snapshot.flatMap((f) => f.jobs);

  const outOfOrder = new Set();
  for (const { jobs: frameJobs } of snapshot) {
    const sorted = [...frameJobs].sort(
      (a, b) => a.scheduledEnd - b.scheduledEnd,
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      if (cur == null || next == null) continue;
      if (cur.actualEnd != null && cur.actualEnd > next.scheduledEnd) {
        outOfOrder.add(cur.jobId);
      }
    }
  }

  const byType =
    /** @type {Record<string, typeof allJobs>} */ Object.fromEntries(
      TYPES.map((t) => [t, []]),
    );
  for (const job of allJobs) {
    if (!job) continue;
    if (byType[job.type]) byType[job.type].push(job);
  }

  TYPES.forEach((type, ti) => {
    const laneY = bounds.y + AXIS_H + ti * (LANE_H + LANE_GAP);
    const stripeY = laneY + Math.floor((LANE_H - STRIPE_H) / 2);
    const color = COLORS[type];

    ctx.fillStyle = '#111';
    ctx.fillRect(LABEL_W, laneY, bounds.w - LABEL_W, LANE_H);

    ctx.fillStyle = color;
    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(type, 4, laneY + LANE_H / 2);

    for (const job of byType[type]) {
      const started = job.actualStart != null;
      const completed = job.actualEnd != null;
      const failed = type === 'H' && job.result === 0;
      const ooo = outOfOrder.has(job.jobId) || failed;

      // Dim: scheduled end, not yet started. Medium: started. Bright: completed.
      if (!started) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = color;
        ctx.fillRect(toX(job.scheduledEnd), stripeY, 1, STRIPE_H);
        ctx.globalAlpha = 1;
      } else if (!completed) {
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = color;
        ctx.fillRect(toX(job.scheduledEnd), stripeY, 1, STRIPE_H);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = ooo ? '#ff4444' : color;
        ctx.fillRect(
          toX(/** @type {number} */ job.actualEnd),
          stripeY,
          1,
          STRIPE_H,
        );
      }
    }
  });
};

// -- Drift panel --

/** @param {number} ms */
const fmtMs = (ms) =>
  Math.abs(ms) >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`;

/**
 * Plots drift decomposed into start delay and duration error.
 * Each completed job shows two markers at the same X (actualEnd):
 *   - dim dot at startDelay (actualStart - scheduledStart) — how late the script launched
 *   - bright dot at totalDrift (actualEnd - scheduledEnd) — full error including duration
 * A faint vertical line connects them; its height is the duration error.
 *
 * Stats rows show:
 *   1. Mean total drift per type with ratio vs H
 *   2. Mean start delay per type (isolates scheduling latency from duration error)
 *   3. Within-frame W/H and G/H ratios (frames where all 4 types completed)
 *      — if these match 1:3.2:4, the cross-frame mean is a sampling artifact
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {NonNullable<ReturnType<typeof getSnapshot>>} snapshot
 * @param {(t: number) => number} toX
 * @param {{y: number, w: number, h: number}} bounds
 * @param {number} now
 * @param {number} tMin
 * @param {number} tMax
 */
const drawDriftPanel = (ctx, snapshot, toX, bounds, now, tMin, tMax) => {
  drawTimeAxis(ctx, toX, bounds, now, tMin, tMax);

  const plotY = bounds.y + AXIS_H;
  const plotH = Math.max(20, bounds.h - AXIS_H - DRIFT_STATS_H);
  const statsY0 = plotY + plotH + 4;

  ctx.fillStyle = '#111';
  ctx.fillRect(LABEL_W, plotY, bounds.w - LABEL_W, plotH);

  drawNowLine(ctx, toX, now, { y: plotY, h: plotH });

  const allJobs = snapshot.flatMap((f) => f.jobs);
  const completedJobs = allJobs.filter((j) => j != null && j.actualEnd != null);

  if (completedJobs.length === 0) {
    ctx.fillStyle = '#555';
    ctx.font = '12px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('No completed jobs yet…', LABEL_W + 8, plotY + plotH / 2);
    return;
  }

  // Total drift = actualEnd - scheduledEnd.
  // Start delay = actualStart - scheduledStart (how late the script launched).
  // Duration error = total drift - start delay (how much longer the op ran than scheduled).
  const drifts = completedJobs.map(
    (j) => /** @type {number} */ j.actualEnd - j.scheduledEnd,
  );
  const startDelays = completedJobs.map((j) =>
    j.actualStart != null ? j.actualStart - j.scheduledStart : 0,
  );
  const allValues = [...drifts, ...startDelays];
  const driftMin = Math.min(...allValues);
  const driftMax = Math.max(...allValues);
  const pad = Math.max(100, (driftMax - driftMin) * 0.15 + 50);
  const dLo = driftMin - pad;
  const dHi = driftMax + pad;
  const dRange = Math.max(1, dHi - dLo);

  // Positive drift up (smaller canvas Y), negative down (larger canvas Y).
  const toYDrift = (/** @type {number} */ d) =>
    plotY + plotH - ((d - dLo) / dRange) * plotH;

  // Y-axis grid ticks
  const mag = Math.pow(10, Math.floor(Math.log10(dRange / 4)));
  const yTickStep = Math.max(1, Math.ceil(dRange / 4 / mag) * mag);
  ctx.font = '9px monospace';
  ctx.textBaseline = 'middle';
  for (
    let d = Math.ceil(dLo / yTickStep) * yTickStep;
    d <= dHi;
    d += yTickStep
  ) {
    const y = Math.round(toYDrift(d));
    if (y < plotY || y > plotY + plotH) continue;
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(LABEL_W, y, bounds.w - LABEL_W, 1);
    const label = fmtMs(d);
    ctx.fillStyle = d === 0 ? '#777' : '#555';
    ctx.fillText(label, 2, y);
  }

  // Zero line
  const zeroY = Math.round(toYDrift(0));
  if (zeroY >= plotY && zeroY <= plotY + plotH) {
    ctx.strokeStyle = '#555';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(LABEL_W, zeroY);
    ctx.lineTo(bounds.w, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Dots: dim marker at startDelay, bright marker at totalDrift, line between them.
  for (const job of completedJobs) {
    const drift = /** @type {number} */ job.actualEnd - job.scheduledEnd;
    const delay =
      job.actualStart != null ? job.actualStart - job.scheduledStart : null;
    const x = Math.round(toX(/** @type {number} */ job.actualEnd));
    if (x < LABEL_W || x > bounds.w) continue;

    const color = COLORS[job.type] || '#888';
    const yDrift = Math.round(toYDrift(drift));
    const yDelay = delay != null ? Math.round(toYDrift(delay)) : null;

    // Line from startDelay to totalDrift (height = duration error)
    if (yDelay != null && Math.abs(yDrift - yDelay) > 1) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, Math.min(yDrift, yDelay));
      ctx.lineTo(x, Math.max(yDrift, yDelay));
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
    }

    // Dim dot at start delay
    if (yDelay != null && yDelay >= plotY && yDelay <= plotY + plotH) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = color;
      ctx.fillRect(x - DOT_SIZE / 2, yDelay - DOT_SIZE / 2, DOT_SIZE, DOT_SIZE);
      ctx.globalAlpha = 1;
    }

    // Bright dot at total drift
    if (yDrift >= plotY && yDrift <= plotY + plotH) {
      ctx.fillStyle = color;
      ctx.fillRect(x - DOT_SIZE / 2, yDrift - DOT_SIZE / 2, DOT_SIZE, DOT_SIZE);
    }
  }

  // -- Stats rows --
  ctx.font = '10px monospace';
  ctx.textBaseline = 'top';

  /** @param {(j: typeof completedJobs[0]) => number} fn @returns {Record<string, number>} */
  const meanByType = (fn) => {
    /** @type {Record<string, number>} */ const out = {};
    for (const type of TYPES) {
      const jobs = completedJobs.filter((j) => j.type === type);
      if (jobs.length === 0) continue;
      out[type] = jobs.reduce((s, j) => s + fn(j), 0) / jobs.length;
    }
    return out;
  };

  /** @param {Record<string, number>} means @param {number} rowY @param {string} label */
  const drawStatsRow = (means, rowY, label) => {
    const hVal = means['H'];
    let x = LABEL_W + 8;
    ctx.fillStyle = '#555';
    ctx.fillText(label, x, rowY);
    x += ctx.measureText(label).width + 6;
    for (const type of TYPES) {
      const val = means[type];
      if (val == null) continue;
      const ratioStr =
        hVal != null && hVal !== 0 && type !== 'H'
          ? ` (×${(val / hVal).toFixed(1)})`
          : '';
      const text = `${type}:${val >= 0 ? '+' : ''}${fmtMs(val)}${ratioStr}`;
      ctx.fillStyle = COLORS[type];
      ctx.fillText(text, x, rowY);
      x += ctx.measureText(text).width + 10;
    }
  };

  // Row 1: total drift
  drawStatsRow(
    meanByType((j) => /** @type {number} */ j.actualEnd - j.scheduledEnd),
    statsY0,
    'drift:',
  );

  // Row 2: start delay only (how late each script was launched)
  drawStatsRow(
    meanByType((j) =>
      j.actualStart != null ? j.actualStart - j.scheduledStart : 0,
    ),
    statsY0 + STATS_LINE_H,
    'start:',
  );

  // Row 3: within-frame drift ratio (only frames where all 4 types completed)
  // If the cross-frame mean ratio (row 1) exceeds these, it's a sampling artifact.
  const completedFrames = snapshot.filter(({ jobs }) =>
    TYPES.every((t) =>
      jobs.some((j) => j != null && j.type === t && j.actualEnd != null),
    ),
  );
  const frameRatioRow = statsY0 + STATS_LINE_H * 2;
  if (completedFrames.length > 0) {
    /** @type {Record<string, number[]>} */
    const ratiosByType = Object.fromEntries(TYPES.map((t) => [t, []]));
    for (const { jobs } of completedFrames) {
      const hJob = jobs.find(
        (j) => j != null && j.type === 'H' && j.actualEnd != null,
      );
      if (!hJob) continue;
      const hDrift = /** @type {number} */ hJob.actualEnd - hJob.scheduledEnd;
      if (hDrift === 0) continue;
      for (const type of TYPES) {
        const j = jobs.find(
          (jj) => jj != null && jj.type === type && jj.actualEnd != null,
        );
        if (j)
          ratiosByType[type].push(
            /** @type {number} */ (j.actualEnd - j.scheduledEnd) / hDrift,
          );
      }
    }
    const frameMeans = /** @type {Record<string, number>} */ {};
    for (const type of TYPES) {
      const rs = ratiosByType[type];
      if (rs.length > 0)
        frameMeans[type] = rs.reduce((a, b) => a + b, 0) / rs.length;
    }
    let x = LABEL_W + 8;
    ctx.fillStyle = '#555';
    const frameLabel = `frame(${completedFrames.length}):`;
    ctx.fillText(frameLabel, x, frameRatioRow);
    x += ctx.measureText(frameLabel).width + 6;
    for (const type of TYPES) {
      const r = frameMeans[type];
      if (r == null) continue;
      const text = type === 'H' ? `H:1.0` : `${type}:×${r.toFixed(1)}`;
      ctx.fillStyle = COLORS[type];
      ctx.fillText(text, x, frameRatioRow);
      x += ctx.measureText(text).width + 10;
    }
  } else {
    ctx.fillStyle = '#444';
    ctx.fillText(
      'frame: waiting for complete frames…',
      LABEL_W + 8,
      frameRatioRow,
    );
  }
};

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog('ALL');
  ns.ui.openTail();

  let startTime = -VIEW_MS;
  let endTime = VIEW_MS;

  const modal = await getTailModal(ns);
  if (!modal) return;
  const headerHeight = modal.top.clientHeight;
  const content = modal.bottom;
  content.style.overflow = 'hidden';
  content.style.padding = 0;
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.height = `calc(100% - ${headerHeight}px)`;

  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:0;flex:1';
  content.appendChild(canvas);

  const buttons = doc.createElement('div');
  const zoomIn = doc.createElement('button');
  const zoomOut = doc.createElement('button');
  zoomIn.innerText = '+';
  zoomOut.innerText = '-';
  zoomIn.addEventListener('click', () => {
    startTime /= 2;
    endTime /= 2;
  });
  zoomOut.addEventListener('click', () => {
    startTime *= 2;
    endTime *= 2;
  });
  buttons.appendChild(zoomIn);
  buttons.appendChild(zoomOut);
  content.appendChild(buttons);

  let /** @type {number} */ rafId = 0;

  const render = () => {
    const snapshot = getSnapshot();
    const w = content.clientWidth || 600;
    const h = Math.max(200, content.clientHeight);
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    if (!snapshot || snapshot.length === 0) {
      ctx.fillStyle = '#555';
      ctx.font = '12px monospace';
      ctx.fillText('Waiting for batch data…', 12, 36);
      rafId = win.requestAnimationFrame(render);
      return;
    }

    const now = Date.now();
    const tMin = now + startTime;
    const tMax = now + endTime;
    const tRange = Math.max(tMax - tMin, 1);
    const toX = (/** @type {number} */ t) =>
      ((t - tMin) / tRange) * (w - LABEL_W) + LABEL_W;

    const driftY = TIMELINE_H + PANEL_GAP;
    const driftH = h - driftY;

    drawTimeline(
      ctx,
      snapshot,
      toX,
      { y: 0, w, h: TIMELINE_H },
      now,
      tMin,
      tMax,
    );

    // Separator
    ctx.fillStyle = '#333';
    ctx.fillRect(0, TIMELINE_H + 2, w, 2);

    if (driftH > AXIS_H + DRIFT_STATS_H + 20)
      drawDriftPanel(
        ctx,
        snapshot,
        toX,
        { y: driftY, w, h: driftH },
        now,
        tMin,
        tMax,
      );

    rafId = win.requestAnimationFrame(render);
  };

  rafId = win.requestAnimationFrame(render);
  ns.atExit(() => win.cancelAnimationFrame(rafId));

  while (true) await ns.sleep(5000);
}
