/**
 * Visual lint — 基于编译后 RenderCmd 估算 bbox，不依赖 SVG 渲染。
 */
export const CANVAS_W = 760;
export const CANVAS_H = 340;
export const MARGIN = 8;
const OVERLAP_IOU = 0.35;

const SKIP_BOUNDS = new Set(['line', 'arrow', 'path']);
const SKIP_OVERLAP = new Set(['line', 'arrow', 'path', 'cols']);
const PRIMARY = new Set([
  'box', 'flow', 'compare', 'buckets', 'chain', 'tree', 'timeline', 'state',
  'stack', 'table', 'queue', 'meter', 'codeblock', 'threads', 'math'
]);

const STRICT_LEGACY = /^\s+(box|text|label|note|circle)\s+\d+\s+\d+/m;
const STRICT_LEGACY_ARROW = /^\s+(line|arrow)\s+\d+/m;
const STRICT_LEGACY_XY = /^\s+(math|flow|compare|meter)\s+\d+\s+\d+/m;

function matchFrame(fr, f) {
  if (fr.min === -1) return true;
  return fr.plus ? f >= fr.min : f === fr.min;
}

function rect(x, y, w, h) {
  return { x, y, w: Math.max(0, w), h: Math.max(0, h) };
}

function mergeZones(zones, cmd) {
  if (cmd.t !== 'cols') return;
  for (const part of cmd.spec.split(/\s+/)) {
    const [name, pos] = part.split(':');
    const x = +pos, w = 120, h = 230, y = 42;
    zones[name] = { x, y, w, h, cx: x + w / 2, cy: y + 68 };
  }
}

function collectCmds(step, frameIdx, depth = 0) {
  const zones = {};
  const cmds = [];
  for (const fr of step._compiled || []) {
    if (!matchFrame(fr, frameIdx)) continue;
    if (fr.layer > depth) continue;
    for (const cmd of fr.cmds) {
      if (cmd.t === 'cols') mergeZones(zones, cmd);
      cmds.push({ cmd, zones: { ...zones } });
    }
  }
  return cmds;
}

function cmdBbox(entry, frameIdx) {
  const { cmd: c, zones } = entry;
  const f = frameIdx;

  switch (c.t) {
    case 'box':
      return rect(c.x, c.y, c.w, c.h);
    case 'note':
      return rect(c.x, c.y, c.w, c.h);
    case 'text':
    case 'label':
    case 'badge': {
      const w = Math.min(200, (c.text?.length || 4) * 10);
      return rect((c.x || 0) - w / 2, (c.y || 0) - 14, w, 28);
    }
    case 'math':
      return rect(c.x, c.y, c.w || 280, c.h || 44);
    case 'code':
    case 'codeblock':
      return rect(c.x, c.y, c.w || 360, c.h || (c.lines?.length || 3) * 18 + 24);
    case 'circle':
      return rect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    case 'meter':
      return rect(c.x, c.y - 8, c.w, 28);
    case 'flow': {
      const stepH = 42;
      const show = Math.min(c.steps?.length || 0, f + 1);
      return rect(c.cx - 70, c.cy, 140, show * stepH + 32);
    }
    case 'compare': {
      const maxLines = Math.max(c.left?.lines?.length || 0, c.right?.lines?.length || 0, 1);
      const w = c.w || Math.min(480, 160 + maxLines * 40);
      const h = c.h || Math.min(120, 52 + maxLines * 22);
      const x = c.x != null ? c.x : Math.round((CANVAS_W - w) / 2);
      const y = c.y != null ? c.y : Math.round((CANVAS_H - h) / 2);
      return rect(x, y - 12, w, h + 12);
    }
    case 'state': {
      const cy = c.y != null ? c.y : Math.round(CANVAS_H / 2);
      const step = Math.min(130, 580 / Math.max(c.states?.length || 1, 1));
      const span = ((c.states?.length || 1) - 1) * step;
      const x0 = c.x0 != null ? c.x0 : Math.round((CANVAS_W - span) / 2);
      return rect(x0 - 16, cy - 14, span + 32, 46);
    }
    case 'timeline': {
      const y = c.y != null ? c.y : 120;
      const step = Math.min(150, (CANVAS_W - 60) / Math.max(c.slots?.length || 1, 1));
      const span = ((c.slots?.length || 1) - 1) * step;
      const x0 = c.x0 != null ? c.x0 : Math.round((CANVAS_W - span) / 2);
      return rect(x0 - 50, y - 20, span + 100, 56);
    }
    case 'stack': {
      const show = Math.min(c.frames?.length || 0, f + 2);
      return rect(c.x, c.y - 10, 120, show * 26 + 10);
    }
    case 'queue': {
      const slotW = 28;
      const totalW = (c.slots || 0) * slotW;
      const cx = c.cx != null ? c.cx : Math.round(CANVAS_W / 2);
      const x0 = Math.max(8, cx - totalW / 2);
      return rect(x0, (c.cy || 180) - 14, totalW, 66);
    }
    case 'table': {
      const colW = 90, rowH = 24;
      const cols = c.rows?.[0]?.length || 1;
      const rows = c.rows?.length || 1;
      const totalW = cols * colW;
      const totalH = rows * rowH;
      const x = c.x != null ? c.x : Math.round((CANVAS_W - totalW) / 2);
      const y = c.y != null ? c.y : Math.round((CANVAS_H - totalH) / 2);
      return rect(x, y, totalW, totalH);
    }
    case 'buckets': {
      const count = c.count || 0;
      const cols = 8;
      const rows = Math.ceil(count / cols);
      return rect(c.x, c.y, cols * 78, rows * 70);
    }
    case 'chain': {
      const n = c.keys?.length || 0;
      const bucketW = 90, nodeW = 72, step = 90;
      const totalW = bucketW + (n > 0 ? 120 + (n - 1) * step + nodeW : 0);
      const bx = c.x != null ? c.x : Math.round((CANVAS_W - totalW) / 2);
      const by = c.y != null ? c.y : 100;
      return rect(bx, by, totalW, 90);
    }
    case 'tree': {
      const { cx, cy, layout } = c;
      if (layout === 'list') {
        const n = c.n || 8;
        const show = Math.min(n, f === 0 ? 4 : n);
        return rect(cx - (show * 28) / 2 - 12, cy - 14, show * 28 + 24, 50);
      }
      if (layout === 'btree') {
        const levels = c.levels || 3;
        return rect(cx - 200, cy, 400, levels * 45 + 40);
      }
      return rect(cx - 95, cy - 40, 190, 130);
    }
    case 'threads': {
      const z = zones[c.zone] || { x: 30, y: 42 };
      const n = c.grow ? (f === 0 ? 3 : 6) : (c.n || 3);
      return rect(z.x, z.y, (z.w || 120), 20 + n * 28);
    }
    case 'cols': {
      let minX = Infinity, maxX = 0;
      for (const part of c.spec.split(/\s+/)) {
        const [name, pos] = part.split(':');
        const x = +pos;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + 120);
      }
      return Number.isFinite(minX) ? rect(minX, 42, maxX - minX, 230) : null;
    }
    case 'callout':
      return rect(
        Math.min(c.x1, c.x2) - 4,
        Math.min(c.y1, c.y2) - 4,
        Math.abs(c.x2 - c.x1) + 80,
        Math.abs(c.y2 - c.y1) + 20
      );
    default:
      return null;
  }
}

function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

function outOfBounds(b) {
  return b.x < MARGIN || b.y < MARGIN
    || b.x + b.w > CANVAS_W - MARGIN
    || b.y + b.h > CANVAS_H - MARGIN;
}

export function lintStrictSource(source) {
  const issues = [];
  if (STRICT_LEGACY.test(source) || STRICT_LEGACY_ARROW.test(source) || STRICT_LEGACY_XY.test(source)) {
    issues.push({ level: 'error', id: 'strict-coords', msg: 'strict 模式禁止裸坐标命令（box/text/arrow 等）' });
  }
  const capRe = /^\s*cap\s+(.+)$/gm;
  let m;
  while ((m = capRe.exec(source)) !== null) {
    for (const seg of m[1].split('|')) {
      if (seg.trim().length > 20) {
        issues.push({ level: 'error', id: 'cap-length', msg: `cap 段超过 20 字：「${seg.trim().slice(0, 24)}…」` });
      }
    }
  }
  return issues;
}

export function lintVisualLesson(lesson, { strict = false } = {}) {
  const issues = [];
  if (!lesson?.steps?.length) return issues;

  lesson.steps.forEach((step, si) => {
    const stepName = step.short || `step${si + 1}`;
    let maxFrameTag = -1;

    for (let f = 0; f < step.frames; f++) {
      const entries = collectCmds(step, f, 0);
      const boxes = [];
      let primaryCount = 0;

      for (const entry of entries) {
        const { cmd } = entry;
        if (PRIMARY.has(cmd.t)) primaryCount++;
        if (SKIP_BOUNDS.has(cmd.t)) continue;
        const bbox = cmdBbox(entry, f);
        if (!bbox || bbox.w <= 0 || bbox.h <= 0) continue;
        if (outOfBounds(bbox)) {
          issues.push({
            level: strict ? 'error' : 'warn',
            id: 'bounds',
            msg: `step「${stepName}」帧${f}·${cmd.t} 越界 (${Math.round(bbox.x)},${Math.round(bbox.y)} ${Math.round(bbox.w)}×${Math.round(bbox.h)})`
          });
        }
        if (!SKIP_OVERLAP.has(cmd.t)) boxes.push({ cmd, bbox });
      }

      if (primaryCount > 3) {
        issues.push({
          level: 'warn',
          id: 'frame-cmd-count',
          msg: `step「${stepName}」帧${f} 主图元 ${primaryCount} 个（建议 ≤3）`
        });
      }

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const ratio = iou(boxes[i].bbox, boxes[j].bbox);
          if (ratio > OVERLAP_IOU) {
            issues.push({
              level: 'warn',
              id: 'overlap',
              msg: `step「${stepName}」帧${f}·${boxes[i].cmd.t} 与 ${boxes[j].cmd.t} 重叠 IoU=${ratio.toFixed(2)}`
            });
          }
        }
      }
    }

    for (const fr of step._compiled || []) {
      if (fr.min >= 0) maxFrameTag = Math.max(maxFrameTag, fr.min);
    }
    if (maxFrameTag >= step.frames) {
      issues.push({
        level: 'warn',
        id: 'frame-cap',
        msg: `step「${stepName}」@标记最大 ${maxFrameTag} 超出 frames=${step.frames}`
      });
    }
  });

  return issues;
}

export function lintLessonFull(lesson, source, { strict = false } = {}) {
  const isStrict = strict || lesson?.mode === 'strict';
  const issues = [];
  if (isStrict && source) issues.push(...lintStrictSource(source));
  issues.push(...lintVisualLesson(lesson, { strict: isStrict }));
  return issues;
}
