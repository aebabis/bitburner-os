import { getTailModal } from '../lib/modal.ts';
import { getGoalSnapshot } from '../lib/goal-tracker.ts';

const doc = eval('document');
const win = eval('window');

const AXIS_H = 22;
const LABEL_W = 55;
const STATS_LINE_H = 14;
const TOP_N = 6;
const DEFAULT_VIEW_MS = 5 * 60 * 1000;

const PALETTE = [
  '#e06c75',
  '#98c379',
  '#e5c07b',
  '#61afef',
  '#c678dd',
  '#56b6c2',
  '#d19a66',
  '#7cc499',
  '#ff9f7f',
  '#da70d6',
];

// djb2 hash — gives each faction a stable color across restarts
const factionColor = (/** @type {string} */ name) => {
  let h = 5381;
  for (let i = 0; i < name.length; i++)
    h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
};

const fmt = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumSignificantDigits: 3,
});
const fmtU = (/** @type {number} */ u) => (u === 0 ? '0' : fmt.format(u));

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {(t: number) => number} toX
 * @param {{ y: number, w: number }} bounds
 * @param {number} now
 * @param {number} tMin
 * @param {number} tMax
 */
const drawTimeAxis = (ctx, toX, { y: panelY, w }, now, tMin, tMax) => {
  ctx.fillStyle = '#222';
  ctx.fillRect(LABEL_W, panelY, w - LABEL_W, AXIS_H);
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
    ctx.fillRect(x, panelY + AXIS_H - 4, 1, 4);
    ctx.fillStyle = '#666';
    const s = ((t - now) / 1000).toFixed(0);
    ctx.fillText(`${+s >= 0 ? '+' : ''}${s}s`, x + 2, panelY + AXIS_H - 6);
  }
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();

  let viewMs = DEFAULT_VIEW_MS;

  const modal = await getTailModal(ns);
  if (!modal) return;
  const headerH = modal.top.clientHeight;
  const content = modal.bottom;
  content.style.overflow = 'hidden';
  content.style.padding = '0';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.height = `calc(100% - ${headerH}px)`;

  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:0;flex:1';
  content.appendChild(canvas);

  const controls = doc.createElement('div');
  const zoomIn = doc.createElement('button');
  const zoomOut = doc.createElement('button');
  zoomIn.textContent = '+';
  zoomOut.textContent = '−';
  zoomIn.addEventListener('click', () => {
    viewMs = Math.max(30_000, viewMs / 2);
  });
  zoomOut.addEventListener('click', () => {
    viewMs = Math.min(30 * 60_000, viewMs * 2);
  });
  controls.append(zoomIn, zoomOut);
  content.appendChild(controls);

  let rafId = 0;

  const render = () => {
    const snapshots = getGoalSnapshot();
    const w = content.clientWidth || 600;
    const h = Math.max(200, content.clientHeight);
    canvas.width = w;
    canvas.height = h;

    const ctx = /** @type {CanvasRenderingContext2D} */ canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    if (snapshots.length === 0) {
      ctx.fillStyle = '#555';
      ctx.font = '12px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('Waiting for goal data…', LABEL_W + 8, h / 2);
      rafId = win.requestAnimationFrame(render);
      return;
    }

    const now = Date.now();
    const tMin = now - viewMs;
    const tMax = now;
    const toX = (/** @type {number} */ t) =>
      LABEL_W + ((t - tMin) / viewMs) * (w - LABEL_W);

    const visible = snapshots.filter((s) => s.ts >= tMin && s.ts <= tMax);

    // Top factions by peak utility in the visible window (fall back to all)
    const source = visible.length > 0 ? visible : snapshots;
    const peakU = /** @type {Map<string, number>} */ new Map();
    for (const snap of source)
      for (const p of snap.plans)
        if (p.utility > (peakU.get(p.faction) ?? 0))
          peakU.set(p.faction, p.utility);
    const topFactions = [...peakU.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([f]) => f);
    const topSet = new Set(topFactions);

    const maxU = Math.max(...topFactions.map((f) => peakU.get(f) ?? 0), 1e-12);

    // Layout
    const STATS_H = (topFactions.length + 1) * STATS_LINE_H + 8;
    const plotY = AXIS_H;
    const plotH = Math.max(40, h - AXIS_H - STATS_H);
    const statsY = plotY + plotH;

    // Map utility to canvas Y: u=0 → bottom, u=maxU*1.1 → top
    const toY = (/** @type {number} */ u) =>
      plotY + plotH * (1 - u / (maxU * 1.1));

    // Plot background
    ctx.fillStyle = '#111';
    ctx.fillRect(LABEL_W, plotY, w - LABEL_W, plotH);

    // Time axis
    drawTimeAxis(ctx, toX, { y: 0, w }, now, tMin, tMax);

    // Y grid + labels
    ctx.font = '9px monospace';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const u = (i / 4) * maxU;
      const y = Math.round(toY(u));
      if (y < plotY || y > plotY + plotH) continue;
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(LABEL_W, y, w - LABEL_W, 1);
      ctx.fillStyle = '#555';
      ctx.fillText(fmtU(u), 2, y);
    }

    // Now line
    const nowX = Math.round(toX(now));
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(nowX, plotY);
    ctx.lineTo(nowX, plotY + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Switch markers: vertical dashed lines where selectedFaction changes
    let prevSel = visible[0]?.selectedFaction ?? null;
    for (const snap of visible) {
      if (snap.selectedFaction !== prevSel) {
        const x = Math.round(toX(snap.ts));
        if (x >= LABEL_W && x <= w) {
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.setLineDash([2, 6]);
          ctx.beginPath();
          ctx.moveTo(x, plotY);
          ctx.lineTo(x, plotY + plotH);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      prevSel = snap.selectedFaction;
    }

    // Clip all line drawing to the plot area
    ctx.save();
    ctx.beginPath();
    ctx.rect(LABEL_W, plotY, w - LABEL_W, plotH);
    ctx.clip();

    // One snapshot before the window for line continuity at the left edge
    const preSnap = snapshots.filter((s) => s.ts < tMin);
    const prevSnap = preSnap[preSnap.length - 1];
    const drawSource = prevSnap ? [prevSnap, ...visible] : visible;

    for (const faction of topFactions) {
      if (!topSet.has(faction)) continue;
      const color = factionColor(faction);

      // Utility line
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.75;
      let started = false;
      for (const snap of drawSource) {
        const plan = snap.plans.find((p) => p.faction === faction);
        if (!plan) {
          started = false;
          continue;
        }
        const x = toX(snap.ts);
        const y = toY(plan.utility);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;

      // Highlight dots where this faction is selected
      ctx.fillStyle = color;
      for (const snap of visible) {
        if (snap.selectedFaction !== faction) continue;
        const plan = snap.plans.find((p) => p.faction === faction);
        if (!plan) continue;
        ctx.fillRect(toX(snap.ts) - 2, toY(plan.utility) - 2, 4, 4);
      }
    }

    ctx.restore();

    // Stats footer
    const lastSnap =
      visible.length > 0
        ? visible[visible.length - 1]
        : snapshots[snapshots.length - 1];
    ctx.font = '11px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#444';
    ctx.fillText('utility', 4, statsY + 2);

    for (let i = 0; i < topFactions.length; i++) {
      const faction = topFactions[i];
      const color = factionColor(faction);
      const plan = lastSnap?.plans.find((p) => p.faction === faction);
      const u = plan?.utility ?? 0;
      const selected = lastSnap?.selectedFaction === faction;
      ctx.fillStyle = color;
      ctx.globalAlpha = selected ? 1 : 0.55;
      ctx.fillText(
        `${selected ? '► ' : '  '}${faction.slice(0, 22).padEnd(22)} ${fmtU(u)}`,
        4,
        statsY + 2 + (i + 1) * STATS_LINE_H,
      );
      ctx.globalAlpha = 1;
    }

    rafId = win.requestAnimationFrame(render);
  };

  rafId = win.requestAnimationFrame(render);
  ns.atExit(() => win.cancelAnimationFrame(rafId));

  while (true) await ns.sleep(5000);
}
