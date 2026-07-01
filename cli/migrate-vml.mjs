/**
 * Legacy lesson.learn → mode strict 批量迁移（启发式）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseLearnSource, lintLearnLesson } from './lib/load-vml.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'library');

const MANUAL = new Map([
  ['redis-cache-breakdown', 'prototypes/vml-v2/redis-cache-breakdown.learn'],
  ['hashmap-collision', 'prototypes/vml-v2/hashmap-collision.learn'],
  ['redis-hot-key', 'prototypes/vml-v2/redis-hot-key.learn'],
]);

function indentOf(s) { return s.match(/^ */)[0].length; }

function parseAttrs(toks) {
  const flags = [];
  const kv = {};
  for (const t of toks) {
    if (['grow', 'pulse', 'fade', 'blink', 'block', 'expired'].includes(t)) flags.push(t);
    else if (t.startsWith('fill=')) kv.fill = t.slice(5);
    else if (t.startsWith('stroke=')) kv.stroke = t.slice(7);
    else if (t.startsWith('opacity=')) kv.opacity = t.slice(8);
    else if (t.startsWith('max=')) kv.max = t.slice(4);
    else if (t.startsWith('filled=')) kv.filled = t.slice(7);
    else if (t.startsWith('hi=')) kv.hi = t.slice(3);
    else if (t.startsWith('levels=')) kv.levels = t.slice(7);
    else if (t.startsWith('highlight=')) kv.highlight = t.slice(10);
    else if (['red', 'blue', 'green', 'orange', 'purple', 'warn', 'muted'].includes(t)) {
      if (!kv.fill) kv.fill = t; else kv.stroke = t;
    }
  }
  return { flags, kv };
}

function attrSuffix({ flags, kv }, extra = {}) {
  const parts = [];
  const m = { ...kv, ...extra };
  if (m.fill) parts.push(`fill=${m.fill}`);
  if (m.stroke) parts.push(`stroke=${m.stroke}`);
  if (m.slot) parts.push(`slot=${m.slot}`);
  if (m.max) parts.push(`max=${m.max}`);
  if (m.filled != null) parts.push(`filled=${m.filled}`);
  if (m.hi != null) parts.push(`hi=${m.hi}`);
  if (m.levels != null) parts.push(`levels=${m.levels}`);
  if (m.highlight != null) parts.push(`highlight=${m.highlight}`);
  if (m.layer != null) parts.push(`layer=L${m.layer}`);
  flags.forEach(f => parts.push(f));
  return parts.length ? ' ' + parts.join(' ') : '';
}

function tokenize(line) {
  const out = []; let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1; while (j < line.length && line[j] !== '"') j++;
      out.push(line.slice(i + 1, j)); i = j + 1;
    } else if (/\s/.test(line[i])) i++;
    else { let j = i; while (j < line.length && !/\s/.test(line[j])) j++; out.push(line.slice(i, j)); i = j; }
  }
  return out;
}

function parseColsSpec(spec) {
  return spec.trim().split(/\s+/).map(part => {
    const [name, pos] = part.split(':');
    return { name, x: +pos };
  }).filter(z => z.name);
}

function zoneForX(zones, x) {
  if (!zones.length) return '中区';
  const cx = x;
  let best = zones[0];
  let bestD = Infinity;
  for (const z of zones) {
    const d = Math.abs(cx - (z.x + 60));
    if (d < bestD) { bestD = d; best = z; }
  }
  return best.name;
}

function inferLayout(step, zones) {
  const ops = step.frames_list.flatMap(f => f.lines.map(l => l.trim().split(/\s+/)[0]));
  const has = op => ops.includes(op);
  if (has('buckets') || has('chain') || (has('tree') && !has('cols'))) return 'flow-focus';
  if (has('flow') && !has('cols')) return 'flow-focus';
  if (has('compare') && !has('cols') && step.frames_list.every(f => f.lines.length <= 3)) return 'flow-focus';
  if (zones.length === 3) return 'three-tier';
  if (zones.length === 2) return 'three-tier';
  if (has('items') || step._rowBoxes >= 3) return 'row-items';
  return zones.length ? 'three-tier' : 'flow-focus';
}

function parseLegacy(source) {
  const lines = source.split('\n');
  const lesson = { comment: '', title: '', tags: '', steps: [] };
  let cur = null, frame = null;
  const stack = [{ indent: -1, type: 'root' }];

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim()) continue;
    const ind = indentOf(line);
    const text = line.trim();
    while (stack.length > 1 && ind <= stack[stack.length - 1].indent) stack.pop();

    if (stack[0] && stack.length === 1 && text.startsWith('#')) {
      lesson.comment = text; continue;
    }
    if (text.startsWith('mode ')) continue;
    if (stack[stack.length - 1].type === 'root' && text.startsWith('lesson ')) {
      lesson.title = text.slice(7).trim(); continue;
    }
    if (stack[stack.length - 1].type === 'root' && text.startsWith('tags ')) {
      lesson.tags = text.slice(5).trim(); continue;
    }
    if (stack[stack.length - 1].type === 'root' && text.startsWith('step ')) {
      cur = { short: text.slice(5).trim(), frames: 2, captions: '', zones: [], frames_list: [], _rowBoxes: 0 };
      lesson.steps.push(cur);
      stack.push({ indent: ind, type: 'step' });
      frame = null;
      continue;
    }
    if (!cur) continue;
    if (text.startsWith('frames ')) { cur.frames = +text.slice(7); continue; }
    if (text.startsWith('cap ')) { cur.captions = text.slice(4).trim(); continue; }
    const fm = text.match(/^@(\d+|all)(\+)?(?:\s+L(\d))?$/);
    if (fm) {
      frame = { tag: text.trim(), min: fm[1], plus: !!fm[2], layer: fm[3] != null ? +fm[3] : 0, lines: [] };
      cur.frames_list.push(frame);
      stack.push({ indent: ind, type: 'frame' });
      continue;
    }
    if (stack[stack.length - 1].type === 'frame') {
      const op = text.split(/\s+/)[0];
      if (op === 'cols') {
        const spec = text.slice(5).trim();
        cur.zones = parseColsSpec(spec);
      } else if (op === 'box') {
        const toks = tokenize(text);
        const x = +toks[1];
        if (x >= 180 && x <= 520) cur._rowBoxes++;
      }
      frame.lines.push(text);
    }
  }
  return lesson;
}

function convertLine(text, ctx) {
  const toks = tokenize(text);
  const op = toks[0];
  const isNum = t => t != null && t !== '' && !Number.isNaN(+t);

  if (op === 'cols') return null;

  if (op === 'arrow') {
    const from = toks[1], to = toks[2];
    let label = '';
    let i = 3;
    if (toks[i] && !['horizontal', 'direct', 'ortho'].includes(toks[i])) { label = toks[i]; i++; }
    const attrs = parseAttrs(toks.slice(i));
    const toTarget = ctx.items.has(to) ? ctx.items.get(to) : to;
    const fromZ = ctx.zoneNames.includes(from) ? from : (ctx.items.has(from) ? from : from);
    if (ctx.zoneNames.includes(from) && (ctx.zoneNames.includes(toTarget) || ctx.items.has(to))) {
      return `link ${fromZ}→${toTarget}${label ? ' ' + label : ''}${attrSuffix(attrs)}`;
    }
    if (ctx.items.has(from) && ctx.zoneNames.includes(toTarget)) {
      return `link ${from}→${toTarget}${label ? ' ' + label : ''}${attrSuffix(attrs)}`;
    }
    return `caption ${from}→${toTarget}${label ? ' ' + label : ''}${attrSuffix({ ...attrs, kv: { ...attrs.kv, slot: 'center' } })}`;
  }

  if (op === 'box') {
    const x = +toks[1], w = +toks[3];
    const raw = text;
    const labelM = raw.match(/label=([^\s]+)/);
    const subM = raw.match(/sub=([^\s]+)/);
    const attrs = parseAttrs(toks.slice(5));
    const label = labelM?.[1] || attrs.kv.label || 'item';
    const id = label.replace(/[^\w\u4e00-\u9fff]/g, '') || 'item';
    const zone = zoneForX(ctx.zones, x + w / 2) || ctx.zoneNames[1] || ctx.zoneNames[0] || '中区';
    ctx.items.set(id, id);
    ctx.items.set(label, id);
    let sub = subM ? ` sub=${subM[1]}` : (attrs.kv.sub ? ` sub=${attrs.kv.sub}` : '');
    return `item ${id} in ${zone} label=${label}${sub}${attrSuffix(attrs)}`;
  }

  if (op === 'text') {
    const attrs = parseAttrs(toks);
    const nums = toks.filter(t => isNum(t));
    const words = toks.slice(1).filter(t => !isNum(t) && !t.includes('=') && !['grow', 'pulse', 'fade', 'blink'].includes(t));
    const content = words.join(' ') || toks[1];
    return `caption ${content}${attrSuffix({ ...attrs, kv: { ...attrs.kv, slot: attrs.kv.slot || 'center' } })}`;
  }

  if (op === 'label') {
    return `caption ${toks[1]}${attrSuffix({ flags: [], kv: { slot: 'top', fill: 'muted' } })}`;
  }

  if (op === 'note') {
    const body = toks.slice(5).join(' ') || toks.slice(1).join(' ');
    return `note ${body}${attrSuffix(parseAttrs(toks))}`;
  }

  if (op === 'threads') {
    const n = +toks[1];
    const attrs = parseAttrs(toks.slice(2));
    let zoneName = attrs.kv.zone;
    if (!zoneName) {
      const zt = toks.find(t => t.startsWith('zone='));
      zoneName = zt ? zt.slice(5) : '请求';
    }
    return `threads ${n} in ${zoneName}${attrSuffix(attrs)}`;
  }

  if (op === 'meter') {
    const t = tokenize(text);
    const words = t.filter(x => !isNum(x) && !x.includes('=') && !['grow', 'pulse'].includes(x));
    const label = words.length ? words[words.length - 1] : '负载';
    return `stress ${label}${attrSuffix(parseAttrs(t))}`;
  }

  if (op === 'badge') {
    const attrs = parseAttrs(toks.slice(2));
    return `badge ${toks[1]}${attrSuffix({ ...attrs, kv: { ...attrs.kv, slot: 'right' } })}`;
  }

  if (op === 'compare') {
    const rest = text.slice(8).trim();
    const nums = tokenize(rest).filter(isNum);
    let body = rest;
    if (nums.length >= 3 && +tokenize(rest)[0] < 200) {
      body = tokenize(rest).slice(3).join(' ');
    }
    return `compare ${body}`;
  }

  if (op === 'flow') {
    const parts = tokenize(text.slice(5));
    const pipe = parts.filter(t => t.includes('|') || !isNum(t)).join(' ');
    const steps = pipe.includes('|') ? pipe : parts.slice(2).join(' ');
    return `flow ${steps}`;
  }

  if (op === 'state') {
    const rest = text.slice(6).trim();
    const parts = tokenize(rest);
    const states = isNum(parts[0]) ? parts.slice(1).join(' ').split(/[,，]/).map(s => s.trim()).filter(Boolean)
      : rest.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    return `state ${states.join(',')}${attrSuffix({ flags: [], kv: { slot: 'bottom' } })}`;
  }

  if (op === 'stack') {
    const frames = text.slice(6).split(/[,，]/).map(s => s.trim()).filter(Boolean);
    if (isNum(tokenize(text)[1])) {
      const t = tokenize(text);
      const fr = t.slice(4).join(' ').split(/[,，]/).map(s => s.trim()).filter(Boolean);
      return `stack ${fr.join(',')}`;
    }
    return `stack ${frames.join(',')}`;
  }

  if (op === 'queue') {
    const t = tokenize(text);
    const cx = +t[1];
    const slots = +t[3];
    const attrs = parseAttrs(t);
    const label = attrs.kv.label || '等待队列';
    const zone = zoneForX(ctx.zones, cx) || ctx.zoneNames[Math.min(1, ctx.zoneNames.length - 1)] || 'Redis';
    return `queue ${label} slots=${slots}${attrSuffix(attrs)} in ${zone}`;
  }

  if (op === 'buckets') {
    const t = tokenize(text);
    const count = +t[1];
    const attrs = parseAttrs(t.slice(2));
    return `buckets ${count}${attrSuffix(attrs)}`;
  }

  if (op === 'chain') {
    const keys = toks.slice(1).map(s => s.includes('"') ? s : `"${s}"`);
    return `chain ${keys.join(' ')}`;
  }

  if (op === 'tree') {
    const kind = toks[1];
    if (kind === 'list') return `tree list ${toks[4] || toks[3]}${attrSuffix(parseAttrs(toks))}`;
    if (kind === 'btree') return `tree btree${attrSuffix(parseAttrs(toks))}`;
    return `tree rb`;
  }

  if (op === 'timeline') {
    const t = tokenize(text);
    const start = isNum(t[0]) ? 1 : 0;
    const slots = t.slice(start).join(' ').replace(/\s+/g, ' ').trim();
    return `timeline ${slots}`;
  }

  if (op === 'codeblock') {
    const hlM = text.match(/highlight=(\d+)/);
    const hlNum = text.match(/^\s*codeblock\s+\d+\s+\d+\s+(\d+)/);
    const highlight = hlM ? hlM[1] : (hlNum ? hlNum[1] : null);
    let body = text.replace(/^\s*codeblock\s+[\d.\s]+/, '').replace(/highlight=\d+\s*/, '').replace(/\bw=\d+\s*/, '');
    const lines = body.split('|').map(s => s.trim()).filter(Boolean);
    return `codeblock ${lines.join('|')}${highlight ? ` highlight=${highlight}` : ''}`;
  }

  if (op === 'math') {
    const m = text.match(/"([^"]+)"/);
    const tex = m ? m[1] : text.replace(/^\s*math\s+[\d.\s]+/, '').trim();
    return `math "${tex}" slot=bottom`;
  }

  if (op === 'callout') {
    const t = tokenize(text);
    const msg = t.slice(5).join(' ') || t[t.length - 1];
    const target = ctx.items.size ? [...ctx.items.keys()][0] : 'hotkey';
    return `callout ${target} ${msg}${attrSuffix(parseAttrs(t))}`;
  }

  if (op === 'lock') {
    const x = +toks[1];
    const zone = zoneForX(ctx.zones, x) || ctx.zoneNames[1] || 'Redis';
    return `item lockKey in ${zone} label=🔒 stroke=purple`;
  }

  if (op === 'circle' || op === 'line' || op === 'path' || op === 'code' || op === 'flows') {
    return null;
  }

  return null;
}

function migrateLesson(source) {
  const lesson = parseLegacy(source);
  const out = [];
  out.push(lesson.comment ? lesson.comment.replace('VML', 'VML Strict') : '# migrated to strict');
  out.push('mode strict');
  out.push(`lesson ${lesson.title}`);
  if (lesson.tags) out.push(`tags ${lesson.tags}`);
  out.push('');

  for (const step of lesson.steps) {
    const zones = step.zones;
    const layout = inferLayout(step, zones);
    out.push(`step ${step.short}`);
    out.push(`  layout ${layout}`);
    out.push(`  frames ${step.frames}`);
    if (step.captions) {
      const caps = step.captions.split('|').map(s => {
        const t = s.trim();
        return t.length > 20 ? t.slice(0, 20) : t;
      }).join(' | ');
      out.push(`  cap ${caps}`);
    }
    if (zones.length) out.push(`  zones ${zones.map(z => z.name).join(' | ')}`);

    const ctx = { zones, zoneNames: zones.map(z => z.name), items: new Map() };

    for (const fr of step.frames_list) {
      const layer = fr.layer ? ` L${fr.layer}` : '';
      out.push(`  ${fr.tag}${layer}`);
      for (const line of fr.lines) {
        const conv = convertLine(line, ctx);
        if (conv) out.push(`    ${conv}`);
      }
    }
    out.push('');
  }
  return out.join('\n').replace(/\n\n+$/, '\n');
}

export function migrateLearnSource(source) {
  if (/^\s*mode\s+strict\s*$/m.test(source)) return source;
  return migrateLesson(source);
}

export function migrateLearnFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (/^\s*mode\s+strict\s*$/m.test(source)) return source;
  return migrateLesson(source);
}

// 已废弃：勿对 library 批量执行。library 保持 legacy，strict v2 仅在 prototypes 试验。

export async function runMigrateVml(args) {
  console.error('migrate-vml 已停用：批量迁移导致排版混乱。请使用 legacy 课程 + prototypes 手写 strict v2。');
  process.exit(1);
}

/*
  const dryRun = args.includes('--dry-run');
  const target = args.find(a => !a.startsWith('--')) || LIB;
  const dirs = fs.existsSync(path.join(target, 'manifest.yaml'))
    ? [target]
    : fs.readdirSync(target, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => path.join(target, d.name))
        .filter(d => fs.existsSync(path.join(d, 'lesson.learn')));

  let ok = 0, fail = 0;
  for (const dir of dirs) {
    const id = path.basename(dir);
    const learnPath = path.join(dir, 'lesson.learn');
    let migrated = null;

    if (MANUAL.has(id)) {
      const manual = path.join(ROOT, MANUAL.get(id));
      if (fs.existsSync(manual)) migrated = fs.readFileSync(manual, 'utf8');
    }
    if (!migrated) migrated = migrateLearnFile(learnPath);

    if (dryRun) {
      console.log(`[dry-run] ${id} → ${migrated.split('\n').length} lines`);
      continue;
    }

    try {
      const lesson = parseLearnSource(migrated);
      const issues = lintLearnLesson(lesson, migrated);
      const errs = issues.filter(i => i.level === 'error');
      fs.writeFileSync(learnPath, migrated);
      if (errs.length) {
        fail++;
        console.warn(`⚠ ${id} 已写入但有 ${errs.length} lint error`);
        errs.slice(0, 3).forEach(e => console.warn(`    ${e.msg}`));
      } else {
        ok++;
        console.log(`✓ ${id}`);
      }
    } catch (e) {
      fail++;
      console.error(`✗ ${id}: ${e.message}`);
    }
  }

  if (!dryRun) console.log(`\n完成: ${ok} 成功, ${fail} 有警告/失败`);
}
*/
