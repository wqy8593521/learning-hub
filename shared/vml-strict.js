/**
 * VML Strict — 语义 DSL → 配方排版 → legacy RenderCmd → 复用 VML.render
 * 须在 shared/vml.js 之后加载；自动接管 mode strict 的 parse。
 */
(function (global) {
  const CANVAS_W = 760;
  const CANVAS_H = 340;

  // ── Parser ──────────────────────────────────────────────
  function parseStrict(source) {
    const lines = source.split('\n');
    const lesson = { mode: 'strict', title: '', tags: [], steps: [] };
    let cur = null, frame = null;
    const stack = [{ indent: -1, type: 'root' }];

    function indentOf(s) { return s.match(/^ */)[0].length; }

    for (const raw of lines) {
      const line = raw.replace(/\r$/, '');
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const ind = indentOf(line);
      const text = line.trim();
      while (stack.length > 1 && ind <= stack[stack.length - 1].indent) stack.pop();

      if (stack[stack.length - 1].type === 'root' && text.startsWith('mode ')) {
        lesson.mode = text.slice(5).trim(); continue;
      }
      if (stack[stack.length - 1].type === 'root' && text.startsWith('lesson ')) {
        lesson.title = text.slice(7).trim(); continue;
      }
      if (stack[stack.length - 1].type === 'root' && text.startsWith('tags ')) {
        lesson.tags = text.slice(5).split(/[,，]/).map(s => s.trim()).filter(Boolean); continue;
      }
      if (stack[stack.length - 1].type === 'root' && text.startsWith('step ')) {
        cur = { short: text.slice(5).trim(), layout: 'three-tier', frames: 2, captions: ['', '', ''], zones: [], cmds: [] };
        lesson.steps.push(cur);
        stack.push({ indent: ind, type: 'step' });
        frame = null;
        continue;
      }
      if (!cur) continue;

      if (text.startsWith('layout ')) { cur.layout = text.slice(7).trim(); continue; }
      if (text.startsWith('frames ')) { cur.frames = +text.slice(7); continue; }
      if (text.startsWith('cap ')) {
        const parts = text.slice(4).split('|').map(s => s.trim());
        cur.captions = [parts[0] || '', parts[1] || parts[0] || '', parts[2] || parts[1] || parts[0] || ''];
        continue;
      }
      if (text.startsWith('zones ')) {
        cur.zones = text.slice(6).split('|').map(s => parseZoneSpec(s.trim()));
        continue;
      }

      const fm = text.match(/^@(\d+|all)(\+)?(?:\s+L(\d))?$/);
      if (fm) {
        frame = { min: fm[1] === 'all' ? -1 : +fm[1], plus: !!fm[2], layer: fm[3] != null ? +fm[3] : 0, lines: [] };
        cur.cmds.push(frame);
        stack.push({ indent: ind, type: 'frame' });
        continue;
      }
      if (stack[stack.length - 1].type === 'frame') frame.lines.push(text);
    }

    for (const step of lesson.steps) {
      step._semFrames = step.cmds.map(fr => ({
        min: fr.min, plus: fr.plus, layer: fr.layer,
        sem: fr.lines.map(l => parseSemLine(l))
      }));
      delete step.cmds;
    }
    return lesson;
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

  function parseAttrs(toks) {
    const a = {};
    for (const t of toks) {
      if (t.startsWith('fill=')) a.fill = t.slice(5);
      else if (t.startsWith('stroke=')) a.stroke = t.slice(7);
      else if (t.startsWith('slot=')) a.slot = t.slice(5);
      else if (t.startsWith('label=')) a.label = t.slice(6);
      else if (t.startsWith('sub=')) a.sub = t.slice(4);
      else if (t.startsWith('max=')) a.max = +t.slice(4);
      else if (t.startsWith('highlight=')) a.highlight = +t.slice(10);
      else if (t.startsWith('hi=')) a.hi = +t.slice(3);
      else if (t.startsWith('levels=')) a.levels = +t.slice(7);
      else if (t.startsWith('filled=')) a.filled = +t.slice(7);
      else if (t.startsWith('slots=')) a.slots = +t.slice(6);
      else if (t === 'grow' || t === 'pulse' || t === 'fade' || t === 'blink' || t === 'block') a[t] = true;
      else if (t.startsWith('layer=L')) a.layer = +t.slice(6);
      else if (['red', 'blue', 'green', 'orange', 'purple', 'warn', 'muted'].includes(t)) {
        if (!a.fill) a.fill = t; else a.stroke = t;
      }
    }
    return a;
  }

  function stripSemAttrs(text) {
    return text
      .replace(/\s+(?:fill|stroke|slot|layer|highlight|hi|levels|filled|slots|max|sub|label|w|h)=[^\s]+/g, '')
      .replace(/\s+(?:grow|pulse|fade|blink|block)\b/g, '')
      .replace(/\s+(?:red|blue|green|orange|purple|warn|muted|lyellow|lgreen|lblue)\b/g, '')
      .trim();
  }

  function semBody(rest, op) {
    return stripSemAttrs(rest.slice(op.length).trim());
  }

  function parseSemLine(line) {
    const layerM = line.match(/\s+layer=L(\d)\s*$/);
    let rest = line;
    const base = { layer: 0 };
    if (layerM) { base.layer = +layerM[1]; rest = line.slice(0, layerM.index).trim(); }

    const toks = tokenize(rest);
    const op = toks[0];
    const attrToks = toks.filter(t => t.includes('=') || ['grow', 'pulse', 'fade', 'blink', 'block'].includes(t));
    const attrs = parseAttrs(attrToks);

    if (op === 'link') {
      const m = rest.match(/^link\s+(.+?)(?:\s+(.+))?$/);
      const [from, to] = m[1].trim().split(/→|->/).map(s => s.trim());
      return { t: 'link', from, to, label: (m[2] || '').trim(), ...attrs, ...base };
    }
    if (op === 'item') {
      const m = rest.match(/^item\s+(\S+)\s+in\s+(\S+)/);
      return { t: 'item', id: m[1], zone: m[2], ...attrs, ...base };
    }
    if (op === 'items') {
      const names = toks.slice(1).filter(t => !t.includes('=') && !['grow', 'pulse'].includes(t));
      return { t: 'items', names, ...attrs, ...base };
    }
    if (op === 'threads') {
      const m = rest.match(/^threads\s+(\d+)\s+in\s+(\S+)/);
      return { t: 'threads', n: +m[1], zone: m[2], ...attrs, ...base };
    }
    if (op === 'stress' || op === 'meter') {
      return { t: 'meter', label: toks[1] || '负载', ...attrs, ...base };
    }
    if (op === 'caption' || op === 'note') {
      const stripped = rest.replace(/\s+(fill|stroke|slot|layer|grow|pulse|fade|blink)=[^\s]+/g, '')
        .replace(/\s+(fill|stroke|slot|grow|pulse|fade|blink)\b/g, '')
        .replace(/\s+(red|blue|green|orange|purple|warn|muted)\b/g, '');
      const text = stripped.slice(op.length + 1).trim();
      return { t: op === 'note' ? 'note' : 'caption', text, ...attrs, ...base };
    }
    if (op === 'badge') return { t: 'badge', text: toks[1], ...attrs, ...base };
    if (op === 'callout') {
      return { t: 'callout', target: toks[1], text: toks.slice(2).join(' '), ...attrs, ...base };
    }
    if (op === 'queue') {
      const m = rest.match(/^queue\s+(.+?)\s+slots=(\d+)/);
      const zoneM = rest.match(/\s+in\s+(\S+)/);
      return { t: 'queue', label: m[1], slots: +m[2], zone: zoneM?.[1], ...attrs, ...base };
    }
    if (op === 'stack') {
      return { t: 'stack', frames: semBody(rest, 'stack').split(/[,，]/).map(s => s.trim()).filter(Boolean), ...attrs, ...base };
    }
    if (op === 'table') {
      const rows = semBody(rest, 'table').split('/').map(r => r.split(/[,，]/).map(s => s.trim()));
      return { t: 'table', rows, ...attrs, ...base };
    }
    if (op === 'codeblock') {
      const hlM = rest.match(/highlight=(\d+)/);
      const body = rest.replace(/\s+highlight=\d+/, '').slice(9);
      const lines = body.split('|').map(s => s.trim());
      return { t: 'codeblock', lines, highlight: hlM ? +hlM[1] : 0, ...attrs, ...base };
    }
    if (op === 'timeline') {
      const parts = semBody(rest, 'timeline').split('|').map(s => s.trim()).filter(Boolean);
      const slots = [];
      for (let i = 0; i < parts.length; i += 2) {
        slots.push({ actor: parts[i], label: parts[i + 1] || parts[i] });
      }
      return { t: 'timeline', slots, ...attrs, ...base };
    }
    if (op === 'flow') {
      return { t: 'flow', steps: semBody(rest, 'flow').split('|').map(s => s.trim()).filter(Boolean), ...attrs, ...base };
    }
    if (op === 'compare') {
      const body = semBody(rest, 'compare');
      const parts = body.split(/\s+vs\s+/i);
      const side = s => { const segs = s.trim().split('|'); return { title: segs[0], lines: segs.slice(1) }; };
      return { t: 'compare', left: side(parts[0] || ''), right: side(parts[1] || ''), ...attrs, ...base };
    }
    if (op === 'math') {
      const restToks = toks.slice(1);
      const isAttr = t => t.includes('=') || t === 'block';
      const attrStart = restToks.findIndex(isAttr);
      const textParts = attrStart === -1 ? restToks : restToks.slice(0, attrStart);
      const text = textParts.join(' ').trim();
      return { t: 'math', text, ...attrs, ...base };
    }
    if (op === 'state') {
      return { t: 'state', states: semBody(rest, 'state').split(/[,，]/).map(s => s.trim()).filter(Boolean), ...attrs, ...base };
    }
    if (op === 'buckets') return { t: 'buckets', count: +toks[1], hi: attrs.hi ?? -1, ...attrs, ...base };
    if (op === 'chain') return { t: 'chain', keys: toks.slice(1).map(s => s.replace(/"/g, '')), ...attrs, ...base };
    if (op === 'tree') {
      const kind = toks[1];
      if (kind === 'list') return { t: 'tree', layout: 'list', n: +toks[2], ...attrs, ...base };
      if (kind === 'btree') return { t: 'tree', layout: 'btree', levels: attrs.levels || 3, ...attrs, ...base };
      return { t: 'tree', layout: 'rb', ...attrs, ...base };
    }
    return { t: 'unknown', raw: line, ...base };
  }

  // ── Recipes ─────────────────────────────────────────────
  function parseZoneSpec(raw) {
    const m = raw.match(/^(.+?)[:@](\d+)$/);
    if (m) return { name: m[1].trim(), x: +m[2] };
    return { name: raw.trim(), x: null };
  }

  function zoneNames(zoneDefs) {
    return zoneDefs.map(z => (typeof z === 'string' ? parseZoneSpec(z) : z).name);
  }

  function zoneLayout(zoneDefs) {
    const zones = {};
    const h = 230, y = 42, w = 120;
    const defs = zoneDefs.map(z => (typeof z === 'string' ? parseZoneSpec(z) : z));
    const auto3 = [30, 310, 600];
    defs.forEach((z, i) => {
      let x = z.x;
      if (x == null) {
        const n = defs.length;
        if (n === 1) x = 30;
        else if (n === 2) x = i === 0 ? 30 : 280;
        else if (n === 3) x = auto3[i] ?? 20 + i * 130;
        else x = 20 + i * (w + 16);
      }
      zones[z.name] = { x, y, w, h, cx: x + w / 2, cy: y + 68 };
    });
    return zones;
  }

  function registerSem(sem, zoneMap, slots) {
    if (sem.t === 'item') {
      const z = zoneMap[sem.zone];
      if (!z) return;
      const w = 140, h = 50, x = z.cx - w / 2, y = z.y + 28;
      zoneMap[sem.id] = { x, y, w, h, cx: z.cx, cy: y + h / 2 };
    }
    if (sem.t === 'items') {
      const cfg = slots.items;
      const totalW = sem.names.length * cfg.w + (sem.names.length - 1) * cfg.gap;
      let x = (CANVAS_W - totalW) / 2;
      sem.names.forEach(name => {
        zoneMap[name] = { x, y: cfg.y, w: cfg.w, h: cfg.h, cx: x + cfg.w / 2, cy: cfg.y + cfg.h / 2 };
        x += cfg.w + cfg.gap;
      });
    }
  }

  function recipeSlots(layout) {
    const flowFocus = layout === 'flow-focus';
    const cx = Math.round(CANVAS_W / 2);
    return {
      top: { x: cx, y: 28, anchor: 'middle' },
      bottom: { x: cx, y: 200 },
      center: { x: cx, y: 170, anchor: 'middle' },
      right: { x: 660, y: 150, anchor: 'middle' },
      flow: { cx: 620, cy: 55 },
      timeline: { y: flowFocus ? 100 : 120 },
      state: { y: 300 },
      tree: { cx, cy: flowFocus ? 100 : 100 },
      compare: { w: 300 },
      items: { y: 70, h: 44, w: 100, gap: 20 },
      stack: { x: 50, y: 60 },
      table: { x: 220, y: 60 },
      queue: { cy: 200 },
      codeblock: { x: 36, y: 168, w: 420 }
    };
  }

  function emitSem(sem, zoneMap, slots, declaredZones) {
    const cmds = [];
    const a = sem;
    const cls = [a.pulse && 'pulse', a.fade && 'fade-in', a.blink && 'key-expired'].filter(Boolean).join(' ');
    const zones = declaredZones || [];
    const zoneList = zoneNames(zones);

    if (sem.t === 'item') {
      const r = zoneMap[sem.id];
      if (!r) return cmds;
      cmds.push({
        t: 'box', x: r.x, y: r.y, w: r.w, h: r.h,
        label: a.label || sem.id, sub: a.sub, stroke: a.stroke || 'red', cls: cls || undefined
      });
      return cmds;
    }
    if (sem.t === 'items') {
      sem.names.forEach(name => {
        const r = zoneMap[name];
        if (r) cmds.push({ t: 'box', x: r.x, y: r.y, w: r.w, h: r.h, label: name, stroke: a.stroke || 'blue' });
      });
      return cmds;
    }
    if (sem.t === 'link') {
      const fromZ = zoneMap[sem.from];
      const toZ = zoneMap[sem.to];
      if (zoneList.includes(sem.from) && zoneList.includes(sem.to)) {
        cmds.push({ t: 'arrow', from: sem.from, to: sem.to, label: sem.label || '' });
      } else if (fromZ && toZ) {
        cmds.push({
          t: 'line',
          x1: fromZ.x + (fromZ.w || 40),
          y1: fromZ.cy,
          x2: toZ.x,
          y2: toZ.cy,
          stroke: 'blue',
          cls: 'draw-line'
        });
        if (sem.label) {
          cmds.push({
            t: 'text', text: sem.label,
            x: (fromZ.cx + toZ.cx) / 2, y: fromZ.cy - 12,
            fill: 'lblue', size: 8
          });
        }
      } else {
        cmds.push({ t: 'arrow', from: sem.from, to: sem.to, label: sem.label || '' });
      }
      return cmds;
    }
    if (sem.t === 'threads') {
      cmds.push({ t: 'threads', n: sem.n, zone: sem.zone, grow: !!a.grow });
      return cmds;
    }
    if (sem.t === 'meter') {
      cmds.push({ t: 'meter', x: 120, y: 160, w: 400, label: sem.label, grow: !!a.grow, max: a.max || 100 });
      return cmds;
    }
    if (sem.t === 'caption') {
      const pos = slots[a.slot || 'center'] || slots.center;
      cmds.push({ t: 'text', text: sem.text, x: pos.x, y: pos.y, fill: a.fill || 'muted', anchor: pos.anchor || 'middle', cls });
      return cmds;
    }
    if (sem.t === 'note') {
      cmds.push({ t: 'note', x: 150, y: 248, w: 460, h: 42, text: sem.text });
      return cmds;
    }
    if (sem.t === 'badge') {
      const pos = slots[a.slot || 'right'] || slots.right;
      cmds.push({ t: 'badge', text: sem.text, x: pos.x, y: pos.y, fill: a.fill || 'warn', cls });
      return cmds;
    }
    if (sem.t === 'flow') {
      const stepH = 42;
      const n = sem.steps.length;
      const cy = Math.max(36, Math.round((CANVAS_H - n * stepH) / 2));
      cmds.push({ t: 'flow', cx: slots.flow.cx, cy, steps: sem.steps });
      return cmds;
    }
    if (sem.t === 'compare') {
      const maxLines = Math.max(sem.left?.lines?.length || 0, sem.right?.lines?.length || 0, 1);
      const w = Math.min(420, 150 + maxLines * 55);
      cmds.push({ t: 'compare', w, left: sem.left, right: sem.right, layout: 'recipe' });
      return cmds;
    }
    if (sem.t === 'math') {
      const y = a.slot === 'bottom' ? 200 : 130;
      cmds.push({ t: 'math', x: 180, y, w: 400, h: 44, text: sem.text, block: !!a.block });
      return cmds;
    }
    if (sem.t === 'callout') {
      const r = zoneMap[sem.target];
      if (r) {
        cmds.push({
          t: 'callout',
          x1: r.x + r.w, y1: r.y + r.h / 2,
          x2: r.x + r.w + 80, y2: r.y - 10,
          text: sem.text
        });
      }
      return cmds;
    }
    if (sem.t === 'state') {
      const sy = slots.state?.y ?? Math.round(CANVAS_H / 2);
      cmds.push({ t: 'state', y: sy, states: sem.states, layout: 'recipe' });
      return cmds;
    }
    if (sem.t === 'timeline') {
      const ty = slots.timeline?.y ?? 120;
      cmds.push({ t: 'timeline', y: ty, slots: sem.slots, layout: 'recipe' });
      return cmds;
    }
    if (sem.t === 'stack') {
      if (zoneList.length > 0 && zoneMap[zoneList[0]]) {
        const z = zoneMap[zoneList[0]];
        cmds.push({ t: 'stack', x: z.x + Math.max(4, (z.w - 120) / 2), y: z.y + 44, frames: sem.frames });
      } else {
        const s = slots.stack || { x: 40, y: 70 };
        cmds.push({ t: 'stack', x: s.x, y: s.y, frames: sem.frames });
      }
      return cmds;
    }
    if (sem.t === 'table') {
      const colW = 90, rowH = 24;
      const cols = sem.rows[0]?.length || 1;
      const rowCount = sem.rows.length;
      const totalW = cols * colW;
      const totalH = rowCount * rowH;
      const x = Math.round((CANVAS_W - totalW) / 2);
      const y = Math.round((CANVAS_H - totalH) / 2);
      cmds.push({ t: 'table', x, y, rows: sem.rows });
      return cmds;
    }
    if (sem.t === 'codeblock') {
      const cb = slots.codeblock || { x: 36, y: 168, w: 420 };
      cmds.push({ t: 'codeblock', x: cb.x, y: cb.y, w: cb.w, lines: sem.lines, highlight: sem.highlight });
      return cmds;
    }
    if (sem.t === 'queue') {
      const z = zoneMap[sem.zone] || { cx: Math.round(CANVAS_W / 2), cy: slots.queue?.cy ?? 180 };
      const slotW = 28;
      const cx = (sem.slots || 6) * slotW > 200 ? Math.round(CANVAS_W / 2) : z.cx;
      const cy = zoneMap[sem.zone] ? zoneMap[sem.zone].y + zoneMap[sem.zone].h - 88 : z.cy;
      cmds.push({ t: 'queue', cx, cy, slots: sem.slots, filled: a.filled, label: sem.label });
      return cmds;
    }
    if (sem.t === 'buckets') cmds.push({ t: 'buckets', count: sem.count, x: 80, y: 90, hi: sem.hi });
    if (sem.t === 'chain') cmds.push({ t: 'chain', keys: sem.keys });
    if (sem.t === 'tree') {
      const tr = slots.tree || { cx: 380, cy: 100 };
      if (sem.layout === 'list') cmds.push({ t: 'tree', layout: 'list', cx: tr.cx, cy: tr.cy, n: sem.n });
      else if (sem.layout === 'btree') cmds.push({ t: 'tree', layout: 'btree', cx: tr.cx, cy: tr.cy, levels: sem.levels });
      else cmds.push({ t: 'tree', layout: 'rb', cx: tr.cx, cy: tr.cy });
      return cmds;
    }
    return cmds;
  }

  function compileLesson(lesson) {
    for (const step of lesson.steps) {
      const layout = step.layout || 'three-tier';
      const zoneDefs = step.zones.map(z => (typeof z === 'string' ? parseZoneSpec(z) : z));
      const names = zoneDefs.map(z => z.name);
      const baseZones = zoneLayout(zoneDefs);
      const slots = recipeSlots(layout);
      const registry = { ...baseZones };
      for (const fr of step._semFrames) {
        for (const sem of fr.sem) registerSem(sem, registry, slots);
      }
      const colsSpec = zoneDefs.map(z => `${z.name}:${baseZones[z.name].x}`).join(' ');
      const needCols = names.length && layout !== 'flow-focus';
      if (needCols && !step._semFrames.some(f => f.min === -1)) {
        step._semFrames.unshift({ min: -1, plus: false, layer: 0, sem: [] });
      }
      const out = [];

      for (const fr of step._semFrames) {
        const byLayer = new Map();
        const push = (layer, cmd) => {
          if (!byLayer.has(layer)) byLayer.set(layer, []);
          byLayer.get(layer).push(cmd);
        };

        if (needCols && fr.min === -1) {
          push(fr.layer, { t: 'cols', spec: colsSpec });
        }
        for (const sem of fr.sem) {
          const L = Math.max(fr.layer, sem.layer || 0);
          emitSem(sem, registry, slots, zoneDefs).forEach(c => push(L, c));
        }

        for (const [layer, cmds] of byLayer) {
          out.push({ min: fr.min, plus: fr.plus, layer, cmds });
        }
      }
      step._compiled = out;
      delete step._semFrames;
    }
    return lesson;
  }

  function isStrictSource(source) {
    return /^\s*mode\s+strict\s*$/m.test(source);
  }

  function lintLesson(lesson) {
    const issues = [];
    if (lesson.mode !== 'strict') issues.push({ level: 'error', id: 'mode', msg: '需要 mode strict' });
    lesson.steps.forEach((step, si) => {
      if (!step.layout) issues.push({ level: 'error', id: 'layout', msg: `step ${si + 1}「${step.short}」缺少 layout` });
      (step._compiled || []).forEach(fr => {
        if (!fr.cmds.length) issues.push({ level: 'warn', id: 'empty-frame', msg: `step ${si + 1}「${step.short}」空帧 L${fr.layer}` });
      });
    });
    return issues;
  }

  function parseAndCompile(source) {
    const lesson = parseStrict(source);
    compileLesson(lesson);
    return lesson;
  }

  function lessonToScenes(lesson) {
    if (!global.VML?.lessonToScenes) throw new Error('需要先加载 shared/vml.js');
    return global.VML.lessonToScenes(lesson);
  }

  global.VMLStrict = {
    parse: parseAndCompile,
    parseAndCompile,
    lessonToScenes,
    lint: lintLesson,
    isStrictSource,
    CANVAS_W,
    CANVAS_H
  };

  if (global.VML?.parse) {
    const legacyParse = global.VML.parse;
    global.VML.parse = function (source) {
      if (isStrictSource(source)) return parseAndCompile(source);
      return legacyParse(source);
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
