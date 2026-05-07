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

  // Canvas
  const canvas = doc.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:0;flex:1";
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
    const h = Math.max(100, content.clientHeight);
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

    const allJobs = snapshot.flatMap((f) => f.jobs);
    const tMin = now + startTime;
    const tMax = now + endTime; //Math.max(now, ...allJobs.map(j => j.scheduledEnd));
    const tRange = Math.max(tMax - tMin, 1);
    const toX = (/** @type {number} */ t) => ((t - tMin) / tRange) * (w - LABEL_W) + LABEL_W;

    // Time axis
    ctx.fillStyle = "#222";
    ctx.fillRect(LABEL_W, 0, w - LABEL_W, AXIS_H);
    ctx.font = "9px monospace";
    ctx.textBaseline = "alphabetic";
    const tickStep = Math.ceil(tRange / 6 / 1000) * 1000;
    for (
      let t = Math.ceil(tMin / tickStep) * tickStep;
      t <= tMax;
      t += tickStep
    ) {
      const x = Math.round(toX(t));
      if (x < LABEL_W) continue;
      ctx.fillStyle = "#444";
      ctx.fillRect(x, AXIS_H - 4, 1, 4);
      ctx.fillStyle = "#666";
      const offsetS = ((t - now) / 1000).toFixed(0);
      ctx.fillText(`${+offsetS >= 0 ? "+" : ""}${offsetS}s`, x + 2, AXIS_H - 6);
    }

    // Now line
    const nowX = Math.round(toX(now));
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(nowX, AXIS_H);
    ctx.lineTo(nowX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Detect out-of-order execution within each frame
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

    // Group jobs by type into fixed lanes
    const byType = /** @type {Record<string, typeof allJobs>} */ (Object.fromEntries(TYPES.map((t) => [t, []])));
    for (const job of allJobs) {
      if (!job) continue;
      if (byType[job.type]) byType[job.type].push(job);
    }

    TYPES.forEach((type, ti) => {
      const laneY = AXIS_H + ti * (LANE_H + LANE_GAP);
      const stripeY = laneY + Math.floor((LANE_H - STRIPE_H) / 2);
      const color = COLORS[type];

      // Lane background
      ctx.fillStyle = "#111";
      ctx.fillRect(LABEL_W, laneY, w - LABEL_W, LANE_H);

      // Lane label
      ctx.fillStyle = color;
      ctx.font = "10px monospace";
      ctx.textBaseline = "middle";
      ctx.fillText(type, 4, laneY + LANE_H / 2);

      for (const job of byType[type]) {
        const started = job.actualStart != null;
        const completed = job.actualEnd != null;
        const failed = type === "H" && job.result === 0;
        const ooo = outOfOrder.has(job.jobId) || failed;

        // Dim stripe at scheduled end: not yet started
        // Medium stripe: started but not finished
        // Bright stripe at actual end: completed
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

    rafId = win.requestAnimationFrame(render);
  };

  rafId = win.requestAnimationFrame(render);
  ns.atExit(() => win.cancelAnimationFrame(rafId));

  while (true) await ns.sleep(5000);
}
