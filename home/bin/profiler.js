import { getTailModal } from '../lib/modal';
import { getSnapshot } from '../lib/profiler';

const doc = eval('document');
const win = eval('window');

const COLORS = { H: '#e06c75', W1: '#56b6c2', G: '#98c379', W2: '#61afef' };
const ROW_H = 14;
const AXIS_H = 22;

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    ns.ui.openTail();

    const modal = await getTailModal(ns);
    const content = modal.bottom;
    content.style.cssText = 'overflow:hidden;padding:0;background:#1a1a1a;display:flex;flex-direction:column';

    // Controls
    const controls = doc.createElement('div');
    controls.style.cssText = [
        'padding:4px 8px',
        'display:flex',
        'gap:14px',
        'align-items:center',
        'font:11px monospace',
        'color:#888',
        'border-bottom:1px solid #333',
        'flex-shrink:0',
    ].join(';');

    // Legend
    const legend = doc.createElement('span');
    legend.style.cssText = 'margin-left:auto;display:flex;gap:8px';
    for (const [type, color] of Object.entries(COLORS)) {
        const swatch = doc.createElement('span');
        swatch.style.cssText = `display:flex;gap:3px;align-items:center`;
        const dot = doc.createElement('span');
        dot.style.cssText = `width:8px;height:8px;background:${color};border-radius:2px;display:inline-block`;
        swatch.appendChild(dot);
        swatch.append(type);
        legend.appendChild(swatch);
    }
    controls.appendChild(legend);
    content.appendChild(controls);

    // Canvas
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'display:block;flex:1;min-height:0';
    content.appendChild(canvas);

    let rafId;

    const render = () => {
        const snapshot = getSnapshot();
        const w = content.clientWidth || 600;
        const h = Math.max(100, content.clientHeight - controls.offsetHeight);
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

        const allJobs = snapshot.flatMap(f => f.jobs);
        const tMin = Math.min(...allJobs.map(j => j.scheduledStart));
        const tMax = Math.max(...allJobs.map(j => j.scheduledEnd));
        const tRange = Math.max(tMax - tMin, 1);
        const toX = t => ((t - tMin) / tRange) * w;

        // Time axis
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, w, AXIS_H);
        ctx.font = '9px monospace';
        const tickStep = Math.ceil(tRange / 6 / 1000) * 1000;
        for (let t = Math.ceil(tMin / tickStep) * tickStep; t <= tMax; t += tickStep) {
            const x = Math.round(toX(t));
            ctx.fillStyle = '#444';
            ctx.fillRect(x, AXIS_H - 4, 1, 4);
            ctx.fillStyle = '#666';
            const offsetS = ((t - now) / 1000).toFixed(0);
            ctx.fillText(`${offsetS >= 0 ? '+' : ''}${offsetS}s`, x + 2, AXIS_H - 6);
        }

        // Now line
        const nowX = Math.round(toX(now));
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(nowX, 0);
        ctx.lineTo(nowX, h);
        ctx.stroke();
        ctx.setLineDash([]);

        const y = AXIS_H;
        for (const job of allJobs) {
            const color = COLORS[job.type] ?? '#888';
            const sx = toX(job.scheduledStart);
            const sw = Math.max(1, toX(job.scheduledEnd) - sx);

            if (sx > w || sx + sw < 0) continue;

            // Scheduled bar (dim)
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = color;
            ctx.fillRect(sx, y, sw, ROW_H);
            ctx.globalAlpha = 1;

            // Actual bar
            if (job.actualStart != null) {
                const ax = toX(job.actualStart);
                const aw = Math.max(1, toX(job.actualEnd ?? now) - ax);
                const failed = job.type === 'H' && job.result === 0;
                ctx.fillStyle = failed ? '#ff4444' : color;
                ctx.fillRect(ax, y, aw, ROW_H);

                // Late indicator: orange pip on bottom edge if >20ms late
                const jitter = job.actualStart - job.scheduledStart;
                if (jitter > 20) {
                    ctx.fillStyle = '#ff8800';
                    ctx.fillRect(ax, y + ROW_H - 2, Math.min(aw, 4), 2);
                }
            }
        }

        rafId = win.requestAnimationFrame(render);
    };

    rafId = win.requestAnimationFrame(render);
    ns.atExit(() => win.cancelAnimationFrame(rafId));

    while (true) await ns.sleep(5000);
}
