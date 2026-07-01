/**
 * VML — Visual Mechanism Language
 * Python 风格缩进 DSL → SVG 渲染器
 * AI 只写 .learn 文件，不写 render() 代码
 */
(function (global) {
  const COLORS = {
    red: '#dc2626', blue: '#3b82f6', orange: '#d97706', green: '#22c55e',
    purple: '#a855f7', warn: '#fbbf24', muted: '#6b7280', fill: '#fca5a5',
    'rb-black': '#1e293b',
    lblue: '#93c5fd', lpurple: '#c4b5fd', lgreen: '#86efac', lyellow: '#fde68a'
  };

  const SURF_FALLBACK = {
    box: '#0a0a10', 'box-alt': '#0a0a12', 'box-hi': '#0f1a30', 'box-on': '#1a2a10',
    'box-queue': '#1a1508', 'box-head': '#151520', panel: '#0a1020', border: '#252530',
    'border-dim': '#333333', muted: '#4b5563', 'lock-bg': '#2a1a3a', 'lock-text': '#e9d5ff',
    meter: '#1a1a22', 'node-text': '#ffffff', 'box-fill': '#1a0a0a', 'state-idle': '#1a1a22'
  };
  let _surfCache = null;
  let _fontScale = null;
  function clearSurfCache() { _surfCache = null; _fontScale = null; }

  const CANVAS_W = 760;
  const CANVAS_H = 340;
  const ROUTE_STYLES = new Set(['horizontal', 'direct', 'ortho']);

  function connectorStyle(cmdRoute) {
    if (cmdRoute && ROUTE_STYLES.has(cmdRoute)) return cmdRoute;
    if (typeof document !== 'undefined' && globalThis.HubPrefs) {
      const s = HubPrefs.load().connectorStyle;
      if (s && ROUTE_STYLES.has(s)) return s;
    }
    return 'horizontal';
  }

  function renderConnector(x1, y1, x2, y2, color, style, cls) {
    const c = cls || 'draw-line';
    if (style === 'direct') {
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" class="${c}"/>`;
    }
    if (style === 'ortho') {
      const midX = (x1 + x2) / 2;
      return `<path d="M ${x1} ${y1} H ${midX} V ${y2} H ${x2}" fill="none" stroke="${color}" stroke-width="2" class="${c}"/>`;
    }
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" class="${c}"/>`;
  }

  function arrowHead(x, y, color, dir) {
    if (dir === 'left') return `<polygon points="${x},${y - 4} ${x - 8},${y} ${x},${y + 4}" fill="${color}"/>`;
    return `<polygon points="${x - 8},${y - 4} ${x},${y} ${x - 8},${y + 4}" fill="${color}"/>`;
  }
  function fontScale() {
    if (_fontScale != null) return _fontScale;
    if (typeof document !== 'undefined' && document.documentElement) {
      const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--viz-font-scale'));
      if (!isNaN(v) && v > 0) { _fontScale = v; return v; }
    }
    _fontScale = 1;
    return 1;
  }
  function fs(n) { return Math.max(7, Math.round(n * fontScale())); }
  function surf(key) {
    if (typeof document !== 'undefined' && document.documentElement) {
      const theme = document.documentElement.dataset.theme || 'dark';
      if (!_surfCache || _surfCache._t !== theme) {
        _surfCache = { _t: theme };
        const st = getComputedStyle(document.documentElement);
        for (const k of Object.keys(SURF_FALLBACK)) {
          const v = st.getPropertyValue(`--viz-${k}`).trim();
          _surfCache[k] = v || SURF_FALLBACK[k];
        }
      }
      return _surfCache[key] || SURF_FALLBACK[key];
    }
    return SURF_FALLBACK[key];
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function richCodeHtml(text, lang) {
    const hi = (typeof VMLRich !== 'undefined') ? VMLRich.highlightCode(text, lang) : esc(text);
    return hi.replace(/\n/g, '<br/>');
  }

  function foreignObject(x, y, w, h, className, inner) {
    return `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="${className}">${inner}</div>
    </foreignObject>`;
  }

  // ── Parser ──────────────────────────────────────────────
  function parseVML(source) {
    const lines = source.split('\n');
    const lesson = { title: '', tags: [], steps: [] };
    let cur = null, frame = null, layer = 0;
    const stack = [{ indent: -1, type: 'root' }];

    function indentOf(s) { return s.match(/^ */)[0].length; }
    function args(s) { return s.trim().split(/\s+/); }

    for (const raw of lines) {
      const line = raw.replace(/\r$/, '');
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const ind = indentOf(line);
      const text = line.trim();

      while (stack.length > 1 && ind <= stack[stack.length - 1].indent) stack.pop();
      const ctx = stack[stack.length - 1];

      if (ctx.type === 'root' && text.startsWith('lesson ')) {
        lesson.title = text.slice(7).trim();
        continue;
      }
      if (ctx.type === 'root' && text.startsWith('tags ')) {
        lesson.tags = text.slice(5).split(/[,，]/).map(s => s.trim()).filter(Boolean);
        continue;
      }
      if (ctx.type === 'root' && text.startsWith('step ')) {
        cur = { short: text.slice(5).trim(), frames: 2, captions: ['', '', ''], cmds: [] };
        lesson.steps.push(cur);
        stack.push({ indent: ind, type: 'step' });
        frame = null; layer = 0;
        continue;
      }
      if (!cur) continue;

      if (text.startsWith('frames ')) { cur.frames = +text.slice(7); continue; }
      if (text.startsWith('cap ')) {
        const parts = text.slice(4).split('|').map(s => s.trim());
        cur.captions = [parts[0] || '', parts[1] || parts[0] || '', parts[2] || parts[1] || parts[0] || ''];
        continue;
      }

      // @0 @1 @1+ @all @1 L1 @2+ L2
      const fm = text.match(/^@(\d+|all)(\+)?(?:\s+L(\d))?$/);
      if (fm) {
        frame = { min: fm[1] === 'all' ? -1 : +fm[1], plus: !!fm[2], layer: fm[3] != null ? +fm[3] : 0, lines: [] };
        cur.cmds.push(frame);
        stack.push({ indent: ind, type: 'frame' });
        layer = frame.layer;
        continue;
      }

      if (stack[stack.length - 1].type === 'frame') {
        frame.lines.push(text);
      }
    }

    // compile lines → command objects
    for (const step of lesson.steps) {
      step._zones = {};
      step._compiled = step.cmds.map(fr => ({
        min: fr.min, plus: fr.plus, layer: fr.layer,
        cmds: fr.lines.map(l => compileLine(l, step))
      }));
      delete step.cmds;
    }
    return lesson;
  }

  function isAttrToken(t) {
    return /^(?:w|h|lang|size|highlight|opacity|fill|stroke|zone|value|max|filled|levels|hi|label|sub)=/.test(t)
      || ['grow', 'pulse', 'block', 'java', 'json'].includes(t);
  }

  function compileLine(line, step) {
    const toks = tokenize(line);
    const op = toks[0];

    if (op === 'label') return { t: 'label', text: toks[1], x: +toks[2], y: +toks[3], anchor: toks[4] || 'center', size: 11, fill: 'muted' };
    if (op === 'text') return { t: 'text', text: toks[1], x: +toks[2], y: +toks[3], ...parseAttrs(toks.slice(4)) };
    if (op === 'box') return { t: 'box', x: +toks[1], y: +toks[2], w: +toks[3], h: +toks[4], ...parseAttrs(toks.slice(5)) };
    if (op === 'note') return { t: 'note', x: +toks[1], y: +toks[2], w: +toks[3], h: +toks[4], text: toks.slice(5).join(' ') };
    if (op === 'code') {
      const attrToks = toks.filter(isAttrToken);
      const attrs = parseAttrs(attrToks);
      const rest = toks.filter(t => !isAttrToken(t));
      const lang = attrs.lang || (attrToks.includes('json') ? 'json' : 'java');
      return { t: 'code', x: +rest[0], y: +rest[1], w: +rest[2], h: +rest[3], text: rest.slice(4).join(' ').replace(/\\n/g, '\n'), lang, ...attrs };
    }
    if (op === 'math') {
      const attrToks = toks.filter(isAttrToken);
      const attrs = parseAttrs(attrToks);
      const rest = toks.filter(t => !isAttrToken(t));
      const x = +rest[0], y = +rest[1];
      let w = attrs.w || 280, h = attrs.h || 44, i = 2;
      if (rest.length >= 4 && !isNaN(+rest[2])) {
        w = +rest[2]; h = +rest[3] || 44; i = 4;
      }
      let text = rest.slice(i).join(' ');
      if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
      return { t: 'math', x, y, w, h, text, block: !!attrs.block, ...attrs };
    }
    if (op === 'circle') return { t: 'circle', x: +toks[1], y: +toks[2], r: +toks[3], ...parseAttrs(toks.slice(4)) };
    if (op === 'line') return { t: 'line', x1: +toks[1], y1: +toks[2], x2: +toks[3], y2: +toks[4], ...parseAttrs(toks.slice(5)) };
    if (op === 'badge') return { t: 'badge', text: toks[1], x: +toks[2], y: +toks[3], ...parseAttrs(toks.slice(4)) };
    if (op === 'cols') return { t: 'cols', spec: toks.slice(1).join(' ') };
    if (op === 'threads') {
      const attrToks = toks.slice(2).filter(isAttrToken);
      const attrs = parseAttrs(attrToks);
      const rest = toks.slice(2).filter(t => !isAttrToken(t));
      const zone = attrs.zone || rest[0] || '线程';
      return { t: 'threads', n: +toks[1], zone, ...attrs };
    }
    if (op === 'flows') return { t: 'flows', path: toks[1] };
    if (op === 'buckets') return { t: 'buckets', count: +toks[1], x: +toks[2], y: +toks[3], hi: -1, ...parseAttrs(toks.slice(4)) };
    if (op === 'chain') return { t: 'chain', keys: toks.slice(1).map(s => s.replace(/"/g, '')) };
    if (op === 'lock') return { t: 'lock', x: +toks[1], y: +toks[2], ...parseAttrs(toks.slice(3)) };
    if (op === 'path') return { t: 'path', d: toks[1], ...parseAttrs(toks.slice(2)) };
    if (op === 'tree') return compileTree(toks.slice(1));
    if (op === 'timeline') return compileTimeline(toks.slice(1));
    if (op === 'compare') return compileCompare(toks.slice(1));
    if (op === 'flow') return compileFlow(toks.slice(1));
    if (op === 'state') return compileState(toks.slice(1));
    if (op === 'stack') return compileStack(toks.slice(1));
    if (op === 'queue') return compileQueue(toks.slice(1));
    if (op === 'meter') return compileMeter(toks.slice(1));
    if (op === 'table') return compileTable(toks.slice(1));
    if (op === 'arrow') {
      let label = '';
      let route = null;
      let i = 3;
      if (toks[3] && ROUTE_STYLES.has(toks[3])) { route = toks[3]; i = 4; }
      else if (toks[3]) { label = toks[3]; i = 4; }
      if (toks[i] && ROUTE_STYLES.has(toks[i])) { route = toks[i]; i++; }
      return { t: 'arrow', from: toks[1], to: toks[2], label, route, ...parseAttrs(toks.slice(i)) };
    }
    if (op === 'codeblock') return compileCodeblock(toks.slice(1));
    if (op === 'callout') return { t: 'callout', x1: +toks[1], y1: +toks[2], x2: +toks[3], y2: +toks[4], text: toks.slice(5).join(' ') };
    return { t: 'text', text: line, x: 380, y: 300, fill: 'muted', size: 9 };
  }

  function splitPipe(s) { return s.split('|').map(x => x.trim()).filter(Boolean); }
  function splitComma(s) { return s.split(/[,，]/).map(x => x.trim()).filter(Boolean); }

  function compileFlow(toks) {
    return { t: 'flow', cx: +toks[0], cy: +toks[1], steps: splitPipe(toks.slice(2).join(' ')) };
  }
  function compileState(toks) {
    return { t: 'state', y: +toks[0], states: splitComma(toks.slice(1).join(' ')) };
  }
  function compileStack(toks) {
    return { t: 'stack', x: +toks[0], y: +toks[1], frames: splitComma(toks.slice(2).join(' ')) };
  }
  function compileQueue(toks) {
    return { t: 'queue', cx: +toks[0], cy: +toks[1], slots: +toks[2], ...parseAttrs(toks.slice(3)) };
  }
  function compileMeter(toks) {
    const attrs = parseAttrs(toks.filter(t => t.includes('=') || ['grow', 'pulse'].includes(t)));
    const nums = toks.filter(t => !t.includes('=') && !['grow', 'pulse'].includes(t));
    return { t: 'meter', x: +nums[0], y: +nums[1], w: +nums[2], label: nums[3] || '负载', ...attrs };
  }
  function compileTable(toks) {
    const rows = toks.slice(2).join(' ').split('/').map(r => splitComma(r));
    return { t: 'table', x: +toks[0], y: +toks[1], rows };
  }
  function compileCodeblock(toks) {
    const attrToks = toks.filter(isAttrToken);
    const attrs = parseAttrs(attrToks);
    const hl = +toks[2];
    let i = 3;
    while (i < toks.length && isAttrToken(toks[i])) i++;
    const lines = splitPipe(toks.slice(i).join(' '));
    return { t: 'codeblock', x: +toks[0], y: +toks[1], highlight: hl, lines, lang: 'java', ...attrs };
  }

  function monoAttr() {
    return 'font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"';
  }

  function fitCodeFontSize(text, maxW, base) {
    let size = base;
    const est = String(text).length * size * 0.58;
    if (est > maxW) size = Math.max(fs(8), Math.floor(base * maxW / est));
    return size;
  }

  function renderCodeSvg(x, y, w, h, lines, highlight, col) {
    const lineH = fs(16);
    const padX = 10;
    const padY = 10;
    const boxH = h || lines.length * lineH + padY * 2;
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${boxH}" rx="6" fill="${surf('box-alt')}" stroke="${col('warn')}" stroke-width="1.5"/>`;
    const innerW = w - padX * 2;
    lines.forEach((ln, i) => {
      const hl = highlight != null && i + 1 === highlight;
      const rowY = y + padY + i * lineH;
      if (hl) {
        s += `<rect x="${x + 4}" y="${rowY}" width="${w - 8}" height="${lineH}" rx="2" fill="${surf('box-queue')}" opacity="0.95"/>`;
      }
      const fz = fitCodeFontSize(ln, innerW, fs(11));
      const ty = rowY + lineH - fs(5);
      s += `<text x="${x + padX}" y="${ty}" fill="${hl ? col('warn') : col('lyellow')}" font-size="${fz}" ${monoAttr()}>${esc(ln)}</text>`;
    });
    return s;
  }

  function compileTree(toks) {
    const kind = toks[0]; // rb | list | btree
    if (kind === 'list') {
      return { t: 'tree', layout: 'list', cx: +toks[1], cy: +toks[2], n: +toks[3], ...parseAttrs(toks.slice(4)) };
    }
    if (kind === 'btree') {
      return { t: 'tree', layout: 'btree', cx: +toks[1], cy: +toks[2], ...parseAttrs(toks.slice(3)) };
    }
    // tree rb cx cy
    return { t: 'tree', layout: kind === 'rb' ? 'rb' : 'rb', cx: +toks[1], cy: +toks[2], ...parseAttrs(toks.slice(3)) };
  }

  function compileTimeline(toks) {
    const y = +toks[0];
    const slots = toks.slice(1).map(s => {
      const sep = s.includes('|') ? '|' : ',';
      const i = s.indexOf(sep);
      if (i === -1) return { actor: s, label: s };
      return { actor: s.slice(0, i).trim(), label: s.slice(i + 1).trim() };
    });
    return { t: 'timeline', y, slots };
  }

  function compileCompare(toks) {
    const x = +toks[0], y = +toks[1], w = +toks[2];
    const rest = toks.slice(3).join(' ');
    const parts = rest.split(/\s+vs\s+/i);
    function parseSide(s) {
      const segs = s.trim().split('|');
      return { title: segs[0], lines: segs.slice(1) };
    }
    return { t: 'compare', x, y, w, left: parseSide(parts[0] || ''), right: parseSide(parts[1] || '') };
  }

  function tokenize(line) {
    const out = []; let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let j = i + 1;
        while (j < line.length && line[j] !== '"') j++;
        out.push(line.slice(i + 1, j)); i = j + 1;
      } else if (/\s/.test(line[i])) i++;
      else {
        let j = i;
        while (j < line.length && !/\s/.test(line[j])) j++;
        out.push(line.slice(i, j)); i = j;
      }
    }
    return out;
  }

  function parseAttrs(toks) {
    const a = {};
    for (const t of toks) {
      if (t === 'center' || t === 'c') a.anchor = 'center';
      else if (t === 'fade') a.cls = 'fade-in';
      else if (t === 'blink') a.cls = 'key-expired';
      else if (t === 'pulse') a.cls = 'pulse';
      else if (t === 'draw') a.cls = 'draw-line';
      else if (t === 'expired') a.cls = (a.cls ? a.cls + ' ' : '') + 'key-expired';
      else if (t.startsWith('label=')) a.label = t.slice(6);
      else if (t.startsWith('sub=')) a.sub = t.slice(4);
      else if (t.startsWith('fill=')) a.fill = COLORS[t.slice(5)] || t.slice(5);
      else if (t.startsWith('stroke=')) a.stroke = COLORS[t.slice(7)] || t.slice(7);
      else if (t.startsWith('opacity=')) a.opacity = +t.slice(8);
      else if (t.startsWith('size=')) a.size = +t.slice(5);
      else if (t.startsWith('hi=')) a.hi = +t.slice(3);
      else if (t.startsWith('levels=')) a.levels = +t.slice(7);
      else if (t.startsWith('zone=')) a.zone = t.slice(5);
      else if (t.startsWith('value=')) a.value = +t.slice(6);
      else if (t.startsWith('max=')) a.max = +t.slice(4);
      else if (t.startsWith('filled=')) a.filled = +t.slice(7);
      else if (t.startsWith('highlight=')) a.highlight = +t.slice(10);
      else if (t.startsWith('lang=')) a.lang = t.slice(5);
      else if (t === 'block') a.block = true;
      else if (t.startsWith('w=')) a.w = +t.slice(2);
      else if (t.startsWith('h=')) a.h = +t.slice(2);
      else if (t.startsWith('grow')) a.grow = true;
      else if (COLORS[t]) { if (!a.fill) a.fill = COLORS[t]; else a.stroke = COLORS[t]; }
    }
    return a;
  }

  // ── Renderer ────────────────────────────────────────────
  function matchFrame(fr, f) {
    if (fr.min === -1) return true;
    return fr.plus ? f >= fr.min : f === fr.min;
  }

  function renderLesson(lesson, depth, frameIdx, stepIdx) {
    const step = lesson.steps[stepIdx];
    if (!step) return '';
    let svg = '';
    const zones = {};

    for (const fr of step._compiled) {
      if (!matchFrame(fr, frameIdx)) continue;
      if (fr.layer > depth) continue;
      for (const cmd of fr.cmds) {
        svg += renderCmd(cmd, frameIdx, zones, depth);
      }
    }
    return svg;
  }

  function renderCmd(c, f, zones, depth) {
    const col = v => COLORS[v] || v;
    switch (c.t) {
      case 'label':
        return `<text x="${c.x}" y="${c.y}" text-anchor="${c.anchor || 'middle'}" fill="${col(c.fill)}" font-size="${fs(c.size || 11)}">${esc(c.text)}</text>`;
      case 'text':
        return `<text x="${c.x}" y="${c.y}" text-anchor="${c.anchor || 'middle'}" fill="${col(c.fill || 'muted')}" font-size="${fs(c.size || 10)}" class="${c.cls || ''}">${esc(c.text)}</text>`;
      case 'box': {
        const stroke = col(c.stroke || 'red'), fill = c.fill ? col(c.fill) : surf('box-fill');
        let s = `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5" opacity="${c.opacity ?? 1}" class="${c.cls || ''}"/>`;
        if (c.label) s += `<text x="${c.x + c.w / 2}" y="${c.y + c.h / 2 - (c.sub ? 4 : 0)}" text-anchor="middle" fill="${col('fill')}" font-size="${fs(12)}" font-weight="600">${esc(c.label)}</text>`;
        if (c.sub) s += `<text x="${c.x + c.w / 2}" y="${c.y + c.h / 2 + 14}" text-anchor="middle" fill="${stroke}" font-size="${fs(9)}">${esc(c.sub)}</text>`;
        return s;
      }
      case 'note':
        return `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="6" fill="${surf('box')}" stroke="${col('purple')}"/><text x="${c.x + c.w / 2}" y="${c.y + c.h / 2 + 4}" text-anchor="middle" fill="${col('lpurple')}" font-size="${fs(9)}">${esc(c.text)}</text>`;
      case 'code': {
        const textLines = String(c.text || '').split('\n');
        const w = c.w || 360;
        return renderCodeSvg(c.x, c.y, w, c.h, textLines, null, col);
      }
      case 'math': {
        const cls = 'vml-math' + (c.block ? ' block' : '');
        return foreignObject(c.x, c.y, c.w, c.h, 'vml-math-wrap',
          `<span class="${cls}" data-tex="${escAttr(c.text)}">${esc(c.text)}</span>`);
      }
      case 'circle':
        return `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${col(c.fill || 'blue')}" opacity="${c.opacity ?? 1}" class="${c.cls || ''}"/>`;
      case 'line':
        return `<line x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}" stroke="${col(c.stroke || 'blue')}" stroke-width="${c.width || 1.5}" opacity="${c.opacity ?? 0.7}" class="${c.cls || ''}"/>`;
      case 'badge':
        return `<text x="${c.x}" y="${c.y}" text-anchor="middle" fill="${col(c.fill || 'warn')}" font-size="${fs(c.size || 14)}" font-weight="700" class="${c.cls || ''}">${esc(c.text)}</text>`;
      case 'path':
        return `<path d="${c.d}" fill="none" stroke="${col(c.stroke || 'purple')}" stroke-width="1.5" stroke-dasharray="4" class="${c.cls || ''}"/>`;
      case 'lock':
        return `<rect x="${c.x}" y="${c.y}" width="80" height="28" rx="4" fill="${surf('lock-bg')}" stroke="${col('purple')}" stroke-width="2"/><text x="${c.x + 40}" y="${c.y + 18}" text-anchor="middle" fill="${surf('lock-text')}" font-size="${fs(9)}">🔒</text>`;
      case 'cols': {
        let s = '';
        for (const part of c.spec.split(/\s+/)) {
          const [name, pos] = part.split(':');
          const x = +pos, w = 120, h = 230, y = 42;
          const colors = { 线程: 'blue', Redis: 'red', MySQL: 'orange' };
          const stroke = col(colors[name] || 'muted');
          zones[name] = { x, y, w, h, cx: x + w / 2, cy: y + 40 };
          s += `<text x="${x + 10}" y="28" fill="${col('muted')}" font-size="${fs(10)}">${esc(name)}</text>`;
          s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${surf('panel')}" stroke="${stroke}" stroke-width="1"/>`;
        }
        Object.assign(zones, zones);
        return s;
      }
      case 'threads': {
        const z = zones[c.zone] || { x: 30, y: 42 };
        const n = c.grow ? (f === 0 ? 3 : f === 1 ? 6 : 6) : c.n;
        let s = '';
        for (let i = 0; i < n; i++) {
          const ty = z.y + 20 + i * 28;
          s += `<circle cx="${z.x + 60}" cy="${ty}" r="7" fill="${col('blue')}"/>`;
          s += `<text x="${z.x + 78}" y="${ty + 3}" fill="${col('lblue')}" font-size="${fs(8)}">T${i + 1}</text>`;
          if (f >= 1 && zones.Redis) {
            const rx = zones.Redis.x;
            s += `<line x1="${z.x + 67}" y1="${ty}" x2="${rx}" y2="${ty}" stroke="${col('blue')}" stroke-width="1.2" opacity="0.6" class="draw-line"/>`;
            if (zones.MySQL) {
              const mx = zones.MySQL.x;
              s += `<line x1="${zones.Redis.x + zones.Redis.w}" y1="${ty}" x2="${mx}" y2="${ty}" stroke="${col('orange')}" stroke-width="${f >= 2 ? 2.5 : 1}" class="draw-line"/>`;
            }
          }
        }
        return s;
      }
      case 'flows': return '';
      case 'buckets': {
        let s = '';
        const hi = c.hi ?? -1;
        for (let i = 0; i < c.count; i++) {
          const x = c.x + (i % 8) * 78, y = c.y + Math.floor(i / 8) * 70;
          const on = i === hi;
          s += `<rect x="${x}" y="${y}" width="68" height="52" rx="4" fill="${on ? surf('box-on') : surf('box')}" stroke="${on ? col('green') : surf('border')}" stroke-width="${on ? 2.5 : 1}"/>`;
          s += `<text x="${x + 34}" y="${y + 22}" text-anchor="middle" fill="${on ? col('lgreen') : surf('muted')}" font-size="${fs(10)}">[${i}]</text>`;
          if (on) s += `<text x="${x + 34}" y="${y + 40}" text-anchor="middle" fill="${col('green')}" font-size="${fs(8)}" class="pulse">命中</text>`;
        }
        return s;
      }
      case 'chain': {
        const n = c.keys.length;
        const bucketW = 90, nodeW = 72, step = 90;
        const totalW = bucketW + (n > 0 ? 120 + (n - 1) * step + nodeW : 0);
        const bx = c.x != null ? c.x : Math.round((CANVAS_W - totalW) / 2);
        const by = c.y != null ? c.y : 100;
        let s = '';
        s += `<rect x="${bx}" y="${by}" width="${bucketW}" height="80" rx="6" fill="${surf('box-on')}" stroke="${col('green')}" stroke-width="2"/>`;
        s += `<text x="${bx + 45}" y="${by + 45}" text-anchor="middle" fill="${col('lgreen')}" font-size="${fs(11)}">[0]</text>`;
        const colors = [col('blue'), col('warn'), col('green')];
        c.keys.forEach((k, i) => {
          const nx = bx + 120 + i * step, ny = by + 40;
          s += `<line x1="${bx + bucketW}" y1="${by + 40}" x2="${nx}" y2="${ny + 22}" stroke="${colors[i % colors.length]}" stroke-width="2" class="draw-line"/>`;
          s += `<rect x="${nx}" y="${ny}" width="${nodeW}" height="44" rx="6" fill="${surf('panel')}" stroke="${colors[i % colors.length]}" stroke-width="2"/>`;
          s += `<text x="${nx + nodeW / 2}" y="${ny + 26}" text-anchor="middle" fill="${colors[i % colors.length]}" font-size="${fs(10)}">${esc(k)}</text>`;
        });
        return s;
      }
      case 'tree': return renderTree(c, f, col);
      case 'timeline': return renderTimeline(c, f, col);
      case 'compare': return renderCompare(c, col);
      case 'flow': return renderFlow(c, f, col);
      case 'state': return renderState(c, f, col);
      case 'stack': return renderStack(c, f, col);
      case 'queue': return renderQueue(c, f, col);
      case 'meter': return renderMeter(c, f, col);
      case 'table': return renderTable(c, f, col);
      case 'codeblock': return renderCodeblock(c, col);
      case 'callout': return renderCallout(c, col);
      default: return '';
    }
  }

  function renderFlow(c, f, col) {
    const stepH = 42, x = c.cx, y0 = c.cy;
    let s = '';
    const show = Math.min(c.steps.length, f + 1);
    for (let i = 0; i < show; i++) {
      const y = y0 + i * stepH;
      const cur = i === f;
      s += `<rect x="${x - 70}" y="${y}" width="140" height="32" rx="6" fill="${cur ? surf('box-hi') : surf('box')}" stroke="${cur ? col('green') : col('blue')}" stroke-width="${cur ? 2 : 1}"/>`;
      s += `<text x="${x}" y="${y + 21}" text-anchor="middle" fill="${cur ? col('lgreen') : col('lblue')}" font-size="${fs(10)}">${esc(c.steps[i])}</text>`;
      if (i < show - 1) {
        s += `<line x1="${x}" y1="${y + 32}" x2="${x}" y2="${y + stepH}" stroke="${col('muted')}" stroke-width="1.5" class="draw-line"/>`;
        s += `<polygon points="${x - 4},${y + stepH - 6} ${x},${y + stepH} ${x + 4},${y + stepH - 6}" fill="${col('muted')}"/>`;
      }
    }
    return s;
  }

  function renderState(c, f, col) {
    const y = c.y != null ? c.y : Math.round(CANVAS_H / 2);
    const step = Math.min(130, 620 / Math.max(c.states.length, 1));
    const span = (c.states.length - 1) * step;
    // legacy 默认 x0=60；strict 配方可传 x0 或 layout=recipe 自动居中
    const x0 = c.x0 != null ? c.x0
      : (c.layout === 'recipe' ? Math.round((CANVAS_W - span) / 2) : 60);
    let s = '';
    c.states.forEach((st, i) => {
      const x = x0 + i * step;
      const done = i < f, cur = i === f;
      s += `<circle cx="${x}" cy="${y}" r="14" fill="${cur ? col('green') : done ? col('blue') : surf('state-idle')}" stroke="${cur ? col('lgreen') : done ? col('lblue') : surf('border-dim')}" stroke-width="2"/>`;
      s += `<text x="${x}" y="${y + 32}" text-anchor="middle" fill="${cur ? col('lgreen') : col('muted')}" font-size="${fs(9)}">${esc(st)}</text>`;
      if (i < c.states.length - 1) {
        s += `<line x1="${x + 16}" y1="${y}" x2="${x + step - 16}" y2="${y}" stroke="${i < f ? col('green') : surf('border-dim')}" stroke-width="${i < f ? 2 : 1}"/>`;
      }
    });
    return s;
  }

  function renderStack(c, f, col) {
    const lineH = 26;
    let s = `<text x="${c.x}" y="${c.y - 8}" fill="${col('muted')}" font-size="${fs(9)}">栈帧</text>`;
    const show = Math.min(c.frames.length, f + 2);
    for (let i = 0; i < show; i++) {
      const y = c.y + i * lineH;
      const cur = i === show - 1 && f >= 0;
      s += `<rect x="${c.x}" y="${y}" width="120" height="22" rx="4" fill="${cur ? surf('box-hi') : surf('box')}" stroke="${cur ? col('warn') : col('blue')}" stroke-width="${cur ? 2 : 1}"/>`;
      s += `<text x="${c.x + 60}" y="${y + 15}" text-anchor="middle" fill="${cur ? col('warn') : col('lblue')}" font-size="${fs(8)}">${esc(c.frames[i])}</text>`;
    }
    return s;
  }

  function renderQueue(c, f, col) {
    const slotW = 28, totalW = c.slots * slotW;
    const x0 = Math.max(8, c.cx - totalW / 2);
    const filled = c.filled != null ? c.filled : (c.grow ? Math.min(c.slots, (f + 1) * 2) : c.slots);
    let s = '';
    if (c.label) s += `<text x="${c.cx}" y="${c.cy - 12}" text-anchor="middle" fill="${col('muted')}" font-size="${fs(9)}">${esc(c.label)}</text>`;
    for (let i = 0; i < c.slots; i++) {
      const on = i < filled;
      s += `<rect x="${x0 + i * slotW}" y="${c.cy}" width="24" height="36" rx="3" fill="${on ? surf('box-queue') : surf('box')}" stroke="${on ? col('orange') : surf('border')}" stroke-width="1"/>`;
      if (on) s += `<text x="${x0 + i * slotW + 12}" y="${c.cy + 22}" text-anchor="middle" fill="${col('orange')}" font-size="${fs(7)}">${i + 1}</text>`;
    }
    if (filled >= c.slots) s += `<text x="${c.cx}" y="${c.cy + 52}" text-anchor="middle" fill="${col('warn')}" font-size="${fs(9)}" class="pulse">队列满→拒绝</text>`;
    return s;
  }

  function renderMeter(c, f, col) {
    const max = c.max || 100;
    const val = c.value != null ? c.value : (c.grow ? Math.min(max, (f + 1) * (max / 3)) : 50);
    const pct = Math.min(100, (val / max) * 100);
    const barColor = pct > 80 ? col('red') : pct > 50 ? col('warn') : col('green');
    let s = `<text x="${c.x}" y="${c.y - 6}" fill="${col('muted')}" font-size="${fs(9)}">${esc(c.label)} ${Math.round(val)}/${max}</text>`;
    s += `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="12" rx="4" fill="${surf('meter')}"/>`;
    s += `<rect x="${c.x}" y="${c.y}" width="${c.w * pct / 100}" height="12" rx="4" fill="${barColor}" class="${pct > 80 ? 'pulse' : ''}"/>`;
    return s;
  }

  function renderTable(c, f, col) {
    if (!c.rows.length) return '';
    const colW = 90, rowH = 24;
    const cols = c.rows[0].length;
    const totalW = cols * colW;
    const totalH = c.rows.length * rowH;
    const x = c.x != null ? c.x : Math.round((CANVAS_W - totalW) / 2);
    const y = c.y != null ? c.y : Math.round((CANVAS_H - totalH) / 2);
    let s = '';
    c.rows.forEach((row, ri) => {
      const highlight = ri > 0 && ri - 1 === f;
      row.forEach((cell, ci) => {
        const cx = x + ci * colW, cy = y + ri * rowH;
        const isHead = ri === 0;
        s += `<rect x="${cx}" y="${cy}" width="${colW - 4}" height="${rowH - 2}" rx="3" fill="${highlight ? surf('box-on') : isHead ? surf('box-head') : surf('box')}" stroke="${highlight ? col('green') : surf('border')}"/>`;
        s += `<text x="${cx + (colW - 4) / 2}" y="${cy + 15}" text-anchor="middle" fill="${isHead ? col('lblue') : highlight ? col('lgreen') : col('muted')}" font-size="${fs(9)}">${esc(cell)}</text>`;
      });
    });
    return s;
  }

  function renderCodeblock(c, col) {
    const w = c.w || 400;
    return renderCodeSvg(c.x, c.y, w, c.h, c.lines, c.highlight, col);
  }

  function renderCallout(c, col) {
    return `<line x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}" stroke="${col('warn')}" stroke-width="1.5" class="callout-line"/>
      <circle cx="${c.x1}" cy="${c.y1}" r="4" fill="${col('warn')}"/>
      <text x="${c.x2}" y="${c.y2}" fill="${col('warn')}" font-size="${fs(9)}">${esc(c.text)}</text>`;
  }

  function zoneStroke(name) {
    const colors = { 线程: 'blue', Redis: 'red', MySQL: 'orange' };
    return COLORS[colors[name]] || COLORS.blue;
  }

  function renderArrow(c, zones, col) {
    const a = zones[c.from], b = zones[c.to];
    if (!a || !b) return '';
    const style = connectorStyle(c.route);
    const color = col(c.stroke) || zoneStroke(c.to) || col('blue');
    const light = c.to === 'Redis' ? col('red') : c.to === 'MySQL' ? col('orange') : col('lblue');
    let x1, y1, x2, y2, tipX, tipY;
    if (style === 'direct') {
      x1 = a.cx; y1 = a.cy; x2 = b.cx; y2 = b.cy;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const inset = 8;
      x2 -= (dx / len) * inset;
      y2 -= (dy / len) * inset;
      tipX = b.cx - (dx / len) * inset;
      tipY = b.cy - (dy / len) * inset;
    } else if (style === 'ortho') {
      x1 = a.x + a.w; y1 = a.cy;
      x2 = b.x; y2 = b.cy;
      tipX = x2; tipY = y2;
    } else {
      x1 = a.x + a.w;
      y1 = a.cy;
      x2 = b.x;
      y2 = b.cy;
      tipX = x2;
      tipY = y2;
    }
    const tipInset = 8;
    let lineEndX = x2;
    let lineEndY = y2;
    if (style === 'horizontal') {
      lineEndX = x2 - tipInset;
      tipX = x2;
      tipY = y2;
    } else if (style === 'ortho') {
      lineEndX = tipX - tipInset;
    }
    let s = '';
    if (style === 'ortho') {
      s = renderConnector(x1, y1, lineEndX, y2, color, style);
    } else if (lineEndX > x1 + 4 || style === 'direct') {
      s = renderConnector(x1, y1, lineEndX, lineEndY, color, style);
    }
    if (style === 'direct') {
      const dx = b.cx - a.cx, dy = b.cy - a.cy;
      const ang = Math.atan2(dy, dx);
      const tx = tipX, ty = tipY;
      const px = tx - Math.cos(ang) * 8, py = ty - Math.sin(ang) * 8;
      s += `<polygon points="${px},${py - 4} ${tx},${ty} ${px},${py + 4}" fill="${color}"/>`;
    } else {
      s += arrowHead(tipX, tipY, color);
    }
    if (c.label) s += `<text x="${(x1 + b.cx) / 2}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle" fill="${light}" font-size="${fs(8)}">${esc(c.label)}</text>`;
    return s;
  }

  function renderTree(c, f, col) {
    const { cx, cy, layout } = c;
    if (layout === 'list') {
      const n = c.n || 8;
      const show = Math.min(n, f === 0 ? 4 : n);
      let s = '';
      const startX = cx - (show * 28) / 2;
      for (let i = 0; i < show; i++) {
        const x = startX + i * 28;
        s += `<circle cx="${x}" cy="${cy}" r="10" fill="${col('blue')}" opacity="0.75"/>`;
        s += `<text x="${x}" y="${cy + 3}" text-anchor="middle" fill="${surf('node-text')}" font-size="${fs(7)}">${i + 1}</text>`;
        if (i < show - 1) s += `<line x1="${x + 10}" y1="${cy}" x2="${x + 18}" y2="${cy}" stroke="${col('muted')}" stroke-width="1.5"/>`;
      }
      if (f >= 1 && n >= 8) s += `<text x="${cx}" y="${cy + 28}" text-anchor="middle" fill="${col('warn')}" font-size="${fs(10)}" class="pulse">8节点 O(n)</text>`;
      return s;
    }
    if (layout === 'btree') {
      const levels = c.levels || 3;
      let s = '';
      const keys = [['10|20'], ['5|10|15', '20|25|30'], ['1', '5', '10', '15', '20', '25', '30', '35']];
      const levelY = [cy, cy + 45, cy + 90];
      for (let lv = 0; lv < Math.min(levels, f + 1); lv++) {
        const row = keys[lv] || keys[keys.length - 1];
        const blockW = 52, gap = 8;
        const totalW = row.length * (blockW + gap);
        let x = cx - totalW / 2;
        row.forEach(k => {
          s += `<rect x="${x}" y="${levelY[lv]}" width="${blockW}" height="28" rx="4" fill="${surf('panel')}" stroke="${col('blue')}" stroke-width="1.5"/>`;
          s += `<text x="${x + blockW / 2}" y="${levelY[lv] + 18}" text-anchor="middle" fill="${col('lblue')}" font-size="${fs(8)}">${esc(k)}</text>`;
          x += blockW + gap;
        });
        if (lv < levels - 1 && f > lv) {
          s += `<line x1="${cx}" y1="${levelY[lv] + 28}" x2="${cx}" y2="${levelY[lv + 1]}" stroke="${col('muted')}" stroke-width="1" class="draw-line"/>`;
        }
      }
      return s;
    }
    // rb — 红黑树静态示意（固定拓扑，仅表达「树化」隐喻，不可配置节点）
    const show = f >= 1;
    if (!show) {
      return `<text x="${cx}" y="${cy}" text-anchor="middle" fill="${col('muted')}" font-size="${fs(10)}">链表过长…</text>`;
    }
    let s = '';
    const nodes = [
      { x: cx, y: cy - 30, r: 14, c: 'rb-black', t: '根' },
      { x: cx - 55, y: cy + 15, r: 11, c: 'red', t: '' },
      { x: cx + 55, y: cy + 15, r: 11, c: 'red', t: '' },
      { x: cx - 90, y: cy + 55, r: 9, c: 'rb-black', t: '' },
      { x: cx - 25, y: cy + 55, r: 9, c: 'rb-black', t: '' },
      { x: cx + 30, y: cy + 55, r: 9, c: 'rb-black', t: '' },
      { x: cx + 85, y: cy + 55, r: 9, c: 'rb-black', t: '' }
    ];
    s += `<line x1="${cx}" y1="${cy - 16}" x2="${cx - 55}" y2="${cy + 4}" stroke="${col('muted')}"/>`;
    s += `<line x1="${cx}" y1="${cy - 16}" x2="${cx + 55}" y2="${cy + 4}" stroke="${col('muted')}"/>`;
    s += `<line x1="${cx - 55}" y1="${cy + 26}" x2="${cx - 90}" y2="${cy + 46}" stroke="${col('muted')}"/>`;
    s += `<line x1="${cx - 55}" y1="${cy + 26}" x2="${cx - 25}" y2="${cy + 46}" stroke="${col('muted')}"/>`;
    s += `<line x1="${cx + 55}" y1="${cy + 26}" x2="${cx + 30}" y2="${cy + 46}" stroke="${col('muted')}"/>`;
    s += `<line x1="${cx + 55}" y1="${cy + 26}" x2="${cx + 85}" y2="${cy + 46}" stroke="${col('muted')}"/>`;
    nodes.forEach(n => {
      const stroke = n.c === 'red' ? col('red') : col('muted');
      s += `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${col(n.c)}" stroke="${stroke}" stroke-width="1.5"/>`;
      if (n.t) s += `<text x="${n.x}" y="${n.y + 4}" text-anchor="middle" fill="${surf('node-text')}" font-size="${fs(8)}">${n.t}</text>`;
    });
    s += `<text x="${cx}" y="${cy + 85}" text-anchor="middle" fill="${col('lgreen')}" font-size="${fs(10)}">红黑树 O(log n)·静态示意</text>`;
    return s;
  }

  function renderTimeline(c, f, col) {
    const y = c.y != null ? c.y : 120;
    const step = Math.min(180, 600 / Math.max(c.slots.length, 1));
    const span = (c.slots.length - 1) * step;
    const x0 = c.x0 != null ? c.x0
      : (c.layout === 'recipe' ? Math.round((CANVAS_W - span) / 2) : 70);
    let s = '';
    c.slots.forEach((slot, i) => {
      const x = x0 + i * step;
      const active = i <= f;
      const cur = i === f;
      s += `<rect x="${x - 50}" y="${y - 20}" width="100" height="40" rx="6" fill="${active ? surf('box-hi') : surf('box')}" stroke="${cur ? col('green') : active ? col('blue') : surf('border')}" stroke-width="${cur ? 2.5 : 1}"/>`;
      s += `<text x="${x}" y="${y - 2}" text-anchor="middle" fill="${active ? col('lblue') : col('muted')}" font-size="${fs(10)}">${esc(slot.actor)}</text>`;
      s += `<text x="${x}" y="${y + 13}" text-anchor="middle" fill="${cur ? col('green') : col('muted')}" font-size="${fs(9)}">${esc(slot.label)}</text>`;
      if (i < c.slots.length - 1) {
        const ax = x + 52, ax2 = x + step - 52;
        s += `<line x1="${ax}" y1="${y}" x2="${ax2}" y2="${y}" stroke="${i < f ? col('green') : surf('border-dim')}" stroke-width="${i < f ? 2 : 1}" class="${i === f - 1 ? 'draw-line' : ''}"/>`;
        if (i < f) s += `<polygon points="${ax2 - 6},${y - 4} ${ax2},${y} ${ax2 - 6},${y + 4}" fill="${col('green')}"/>`;
      }
    });
    return s;
  }

  function renderCompare(c, col) {
    const gap = 16;
    const maxLines = Math.max(c.left?.lines?.length || 0, c.right?.lines?.length || 0, 1);
    const w = c.w || Math.min(480, 160 + maxLines * 40);
    const h = c.h || Math.min(120, 52 + maxLines * 22);
    const half = (w - gap) / 2;
    // legacy 的 compare x/y 写在 DSL 里但历史上被渲染器忽略，仍居中
    const legacyCoords = c.x != null && c.y != null && c.layout !== 'recipe';
    const x = legacyCoords || c.x == null ? Math.round((CANVAS_W - w) / 2) : c.x;
    const y = legacyCoords || c.y == null ? Math.round((CANVAS_H - h) / 2) : c.y;
    const sides = [{ data: c.left, stroke: 'blue', x }, { data: c.right, stroke: 'purple', x: x + half + gap }];
    let s = `<text x="${x + w / 2}" y="${y - 8}" text-anchor="middle" fill="${col('muted')}" font-size="${fs(10)}">对比</text>`;
    sides.forEach(side => {
      const d = side.data;
      const lineCount = Math.max(d.lines.length, 1);
      const innerH = 28 + lineCount * 22;
      const boxY = y + Math.max(0, (h - innerH) / 2);
      s += `<rect x="${side.x}" y="${boxY}" width="${half}" height="${innerH}" rx="8" fill="${surf('box')}" stroke="${col(side.stroke)}" stroke-width="1.5"/>`;
      s += `<text x="${side.x + half / 2}" y="${boxY + 20}" text-anchor="middle" fill="${col(side.stroke)}" font-size="${fs(12)}" font-weight="600">${esc(d.title)}</text>`;
      d.lines.forEach((ln, i) => {
        s += `<text x="${side.x + half / 2}" y="${boxY + 42 + i * 22}" text-anchor="middle" fill="${col('muted')}" font-size="${fs(10)}">${esc(ln)}</text>`;
      });
    });
    s += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" fill="${surf('muted')}" font-size="${fs(14)}">vs</text>`;
    return s;
  }

  function renderLessonFixed(lesson, depth, frameIdx, stepIdx, opts = {}) {
    const step = lesson.steps[stepIdx];
    if (!step) return '';
    const skip = new Set(opts.skipTypes || []);
    const zones = {};
    let svg = '';
    for (const fr of step._compiled) {
      if (!matchFrame(fr, frameIdx)) continue;
      if (fr.layer > depth) continue;
      for (const cmd of fr.cmds) {
        if (skip.has(cmd.t)) continue;
        if (cmd.t === 'cols') {
          for (const part of cmd.spec.split(/\s+/)) {
            const [name, pos] = part.split(':');
            const x = +pos, w = 120, h = 230, y = 42;
            zones[name] = { x, y, w, h, cx: x + w / 2, cy: y + 68 };
          }
        }
        svg += renderCmdWithZones(cmd, frameIdx, zones, depth);
      }
    }
    return svg;
  }

  function extractCodeblock(lesson, depth, frameIdx, stepIdx) {
    const step = lesson.steps[stepIdx];
    if (!step) return null;
    let last = null;
    for (const fr of step._compiled) {
      if (!matchFrame(fr, frameIdx)) continue;
      if (fr.layer > depth) continue;
      for (const cmd of fr.cmds) {
        if (cmd.t === 'codeblock') last = cmd;
      }
    }
    return last;
  }

  function renderCmdWithZones(c, f, zones, depth) {
    if (c.t === 'cols') {
      let s = '';
      for (const part of c.spec.split(/\s+/)) {
        const [name, pos] = part.split(':');
        const x = +pos, w = 120, h = 230, y = 42;
        const colors = { 线程: 'blue', Redis: 'red', MySQL: 'orange' };
        const stroke = COLORS[colors[name]] || COLORS.muted;
        zones[name] = { x, y, w, h, cx: x + w / 2, cy: y + 68 };
        s += `<text x="${x + 10}" y="28" fill="${COLORS.muted}" font-size="${fs(10)}">${esc(name)}</text>`;
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${surf('panel')}" stroke="${stroke}" stroke-width="1"/>`;
      }
      return s;
    }
    if (c.t === 'threads') {
      const z = zones[c.zone] || { x: 30, y: 42, cx: 90 };
      const n = c.grow ? Math.min(6, f === 0 ? 3 : 6) : c.n;
      let s = '';
      for (let i = 0; i < n; i++) {
        const ty = z.y + 20 + i * 28;
        const tcx = z.x + (z.w ? 30 : 60);
        s += `<circle cx="${tcx}" cy="${ty}" r="7" fill="${COLORS.blue}"/>`;
        s += `<text x="${tcx + 18}" y="${ty + 3}" fill="${COLORS.lblue}" font-size="${fs(8)}">T${i + 1}</text>`;
        if (f >= 1 && zones.Redis) {
          const rx = zones.Redis.x;
          const style = connectorStyle();
          const tcxEnd = tcx + 7;
          if (style === 'direct') {
            s += renderConnector(tcxEnd, ty, zones.Redis.cx, zones.Redis.cy, COLORS.blue, style);
          } else if (style === 'ortho') {
            const midX = (tcxEnd + rx) / 2;
            s += `<path d="M ${tcxEnd} ${ty} H ${midX} V ${zones.Redis.cy} H ${rx}" fill="none" stroke="${COLORS.blue}" stroke-width="1.2" opacity="0.6" class="draw-line"/>`;
          } else {
            s += `<line x1="${tcxEnd}" y1="${ty}" x2="${rx}" y2="${ty}" stroke="${COLORS.blue}" stroke-width="1.2" opacity="0.6" class="draw-line"/>`;
          }
          if (zones.MySQL) {
            const mx = zones.MySQL.x;
            const rxEnd = zones.Redis.x + zones.Redis.w;
            if (style === 'direct') {
              s += renderConnector(rxEnd, ty, zones.MySQL.cx, zones.MySQL.cy, COLORS.orange, style);
            } else if (style === 'ortho') {
              const midX = (rxEnd + mx) / 2;
              s += `<path d="M ${rxEnd} ${ty} H ${midX} V ${zones.MySQL.cy} H ${mx}" fill="none" stroke="${COLORS.orange}" stroke-width="${f >= 2 ? 2.5 : 1}" class="draw-line"/>`;
            } else {
              s += `<line x1="${rxEnd}" y1="${ty}" x2="${mx}" y2="${ty}" stroke="${COLORS.orange}" stroke-width="${f >= 2 ? 2.5 : 1}" class="draw-line"/>`;
            }
          }
        }
      }
      return s;
    }
    if (c.t === 'arrow') return renderArrow(c, zones, v => COLORS[v] || v);
    return renderCmd(c, f, zones, depth);
  }

  function lessonToScenes(lesson) {
    return lesson.steps.map((step, stepIdx) => ({
      short: step.short,
      captions: step.captions,
      frames: step.frames,
      render(d, f, opts) { return renderLessonFixed(lesson, d, f, stepIdx, opts); }
    }));
  }

  global.VML = { parse: parseVML, render: renderLessonFixed, lessonToScenes, extractCodeblock, clearSurfCache };
})(typeof window !== 'undefined' ? window : globalThis);
