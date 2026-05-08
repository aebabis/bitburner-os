import { getTailModal } from "../lib/modal";
import { getSnapshot } from "../lib/profiler";

const doc = eval("document");
const win = eval("window");

const COLORS = /** @type {Record<string, string>} */ ({ H: "#e5c07b", W1: "#56b6c2", G: "#98c379", W2: "#61afef" });
const TYPES = ["H", "W1", "G", "W2"];
const AXIS_H = 22;
const LABEL_W = 28;
const LANE_H = 20;
const LANE_GAP = 4;
const STRIPE_H = 16;
const VIEW_MS = 10_000;
const DOT_SIZE = 3;
const PANEL_GAP = 6;

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
  ctx.fillStyle = "#222";
  ctx.fillRect(LABEL_W, bounds.y, bounds.w - LABEL_W, AXIS_H);
  ctx.font = "9px monospace";
  ctx.textBaseline = "alphabetic";
  const tRange = tMax - tMin;
  const tickStep = Math.ceil(tRange / 6 / 1000) * 1000;
  for (let t = Math.ceil(tMin / tickStep) * tickStep; t <= tMax; t += tickStep) {
    const x = Math.round(toX(t));
    if (x < LABEL_W) continue;
    ctx.fillStyle = "#444";
    ctx.fillRect(x, bounds.y + AXIS_H - 4, 1, 4);
    ctx.fillStyle = "#666";
    const offsetS = ((t - now) / 1000).toFixed(0);
    ctx.fillText(`${+offsetS >= 0 ? "+" : ""}${offsetS}s`, x + 2, bounds.y + AXIS_H - 6);
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
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
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
    const sorted = [...frameJobs].sort((a, b) => a.scheduledEnd - b.scheduledEnd);
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      if (cur == null || next == null) continue;
      if (cur.actualEnd != null && cur.actualEnd > next.scheduledEnd) {
        outOfOrder.add(cur.jobId);
      }
    }
  }

  const byType = /** @type {Record<string, typeof allJobs>} */ (Object.fromEntries(TYPES.map((t) => [t, []])));
  for (const job of allJobs) {
    if (!job) continue;
    if (byType[job.type]) byType[job.type].push(job);
  }

  TYPES.forEach((type, ti) => {
    const laneY = bounds.y + AXIS_H + ti * (LANE_H + LANE_GAP);
    const stripeY = laneY + Math.floor((LANE_H - STRIPE_H) / 2);
    const color = COLORS[type];

    ctx.fillStyle = "#111";
    ctx.fillRect(LABEL_W, laneY, bounds.w - LABEL_W, LANE_H);

    ctx.fillStyle = color;
    ctx.font = "10px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(type, 4, laneY + LANE_H / 2);

    for (const job of byType[type]) {
      const started = job.actualStart != null;
      const completed = job.actualEnd != null;
      const failed = type === "H" && job.result === 0;
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
        ctx.fillStyle = ooo ? "#ff4444" : color;
        ctx.fillRect(toX(/** @type {number} */ (job.actualEnd)), stripeY, 1, STRIPE_H);
      }
    }
  });
};

// -- Drift panel --

/**
 * Plots actualEnd - scheduledEnd per completed job. If timing drift is caused by
 * player leveling up after batch creation, W1/W2 drift should be ~4× H drift and
 * G drift ~3.2× H drift, because weakenTime = 4×hackTime and growTime = 3.2×hackTime.
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
  const plotH = bounds.h - AXIS_H;

  ctx.fillStyle = "#111";
  ctx.fillRect(LABEL_W, plotY, bounds.w - LABEL_W, plotH);

  drawNowLine(ctx, toX, now, { y: plotY, h: plotH });

  const allJobs = snapshot.flatMap((f) => f.jobs);
  const completedJobs = allJobs.filter((j) => j != null && j.actualEnd != null);

  if (completedJobs.length === 0) {
    ctx.fillStyle = "#555";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText("No completed jobs yet…", LABEL_W + 8, plotY + plotH / 2);
    return;
  }

  // Drift = actualEnd - scheduledEnd; negative means finished early.
  const drifts = completedJobs.map((j) => /** @type {number} */ (j.actualEnd) - j.scheduledEnd);
  const driftMin = Math.min(...drifts);
  const driftMax = Math.max(...drifts);
  const pad = Math.max(100, (driftMax - driftMin) * 0.15 + 50);
  const dLo = driftMin - pad;
  const dHi = driftMax + pad;
  const dRange = Math.max(1, dHi - dLo);

  // Positive drift up (smaller canvas Y), negative down (larger canvas Y).
  const toYDrift = (/** @type {number} */ d) => plotY + plotH - ((d - dLo) / dRange) * plotH;

  // Y-axis grid ticks
  const mag = Math.pow(10, Math.floor(Math.log10(dRange / 4)));
  const yTickStep = Math.max(1, Math.ceil(dRange / 4 / mag) * mag);
  ctx.font = "9px monospace";
  ctx.textBaseline = "middle";
  for (let d = Math.ceil(dLo / yTickStep) * yTickStep; d <= dHi; d += yTickStep) {
    const y = Math.round(toYDrift(d));
    if (y < plotY || y > plotY + plotH) continue;
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(LABEL_W, y, bounds.w - LABEL_W, 1);
    const label = Math.abs(d) >= 1000 ? `${(d / 1000).toFixed(1)}s` : `${d}ms`;
    ctx.fillStyle = d === 0 ? "#777" : "#555";
    ctx.fillText(label, 2, y);
  }

  // Zero line
  const zeroY = Math.round(toYDrift(0));
  if (zeroY >= plotY && zeroY <= plotY + plotH) {
    ctx.strokeStyle = "#555";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(LABEL_W, zeroY);
    ctx.lineTo(bounds.w, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Dots
  for (const job of completedJobs) {
    const drift = /** @type {number} */ (job.actualEnd) - job.scheduledEnd;
    const x = Math.round(toX(/** @type {number} */ (job.actualEnd)));
    const y = Math.round(toYDrift(drift));
    if (x < LABEL_W || x > bounds.w || y < plotY || y > plotY + plotH) continue;
    ctx.fillStyle = COLORS[job.type] || "#888";
    ctx.fillRect(x - DOT_SIZE / 2, y - DOT_SIZE / 2, DOT_SIZE, DOT_SIZE);
  }

  // Stats row: mean drift per type + ratio vs H to confirm 1:3.2:4 theory
  /** @type {Record<string, number>} */
  const meanDrift = {};
  for (const type of TYPES) {
    const jobs = completedJobs.filter((j) => j.type === type);
    if (jobs.length === 0) continue;
    meanDrift[type] = jobs.reduce((s, j) => s + (/** @type {number} */ (j.actualEnd) - j.scheduledEnd), 0) / jobs.length;
  }

  const hMean = meanDrift["H"];
  ctx.font = "10px monospace";
  ctx.textBaseline = "top";
  let statsX = LABEL_W + 8;
  const statsY = plotY + 4;
  for (const type of TYPES) {
    const mean = meanDrift[type];
    if (mean == null) continue;
    const ratioStr =
      hMean != null && hMean !== 0 && type !== "H"
        ? ` (×${(mean / hMean).toFixed(1)})`
        : "";
    const label = `${type}:${mean >= 0 ? "+" : ""}${mean.toFixed(0)}ms${ratioStr}`;
    ctx.fillStyle = COLORS[type];
    ctx.fillText(label, statsX, statsY);
    statsX += ctx.measureText(label).width + 12;
  }
};

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  let startTime = -VIEW_MS;
  let endTime = VIEW_MS;

  const modal = await getTailModal(ns);
  if (!modal) return;
  const headerHeight = modal.top.clientHeight;
  const content = modal.bottom;
  content.style.overflow = "hidden";
  content.style.padding = 0;
  content.style.display = "flex";
  content.style.flexDirection = "column";
  content.style.height = `calc(100% - ${headerHeight}px)`;

  const canvas = doc.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:0;flex:1";
  content.appendChild(canvas);

  const buttons = doc.createElement("div");
  const zoomIn = doc.createElement("button");
  const zoomOut = doc.createElement("button");
  zoomIn.innerText = "+";
  zoomOut.innerText = "-";
  zoomIn.addEventListener("click", () => {
    startTime /= 2;
    endTime /= 2;
  });
  zoomOut.addEventListener("click", () => {
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

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    if (!snapshot || snapshot.length === 0) {
      ctx.fillStyle = "#555";
      ctx.font = "12px monospace";
      ctx.fillText("Waiting for batch data…", 12, 36);
      rafId = win.requestAnimationFrame(render);
      return;
    }

    const now = Date.now();
    const tMin = now + startTime;
    const tMax = now + endTime;
    const tRange = Math.max(tMax - tMin, 1);
    const toX = (/** @type {number} */ t) => ((t - tMin) / tRange) * (w - LABEL_W) + LABEL_W;

    const driftY = TIMELINE_H + PANEL_GAP;
    const driftH = h - driftY;

    drawTimeline(ctx, snapshot, toX, { y: 0, w, h: TIMELINE_H }, now, tMin, tMax);

    // Separator
    ctx.fillStyle = "#333";
    ctx.fillRect(0, TIMELINE_H + 2, w, 2);

    if (driftH > AXIS_H + 20)
      drawDriftPanel(ctx, snapshot, toX, { y: driftY, w, h: driftH }, now, tMin, tMax);

    rafId = win.requestAnimationFrame(render);
  };

  rafId = win.requestAnimationFrame(render);
  ns.atExit(() => win.cancelAnimationFrame(rafId));

  while (true) await ns.sleep(5000);
}
