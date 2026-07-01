/**
 * .narrate DSL — 口语旁白稿（浏览器 + Node 共用）
 *
 * step 步骤名          # 与 lesson.learn 的 step 短名一致
 *   @0 L1: 旁白正文…   # 帧 0、L1；可写 @1+ @all
 */
(function (global) {
  function parseNarrate(source) {
    const doc = { title: '', steps: [] };
    let cur = null;
    const stack = [{ indent: -1, type: 'root' }];

    for (const raw of source.split('\n')) {
      const line = raw.replace(/\r$/, '');
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const ind = line.match(/^ */)[0].length;
      const text = line.trim();
      while (stack.length > 1 && ind <= stack[stack.length - 1].indent) stack.pop();

      const ctx = stack[stack.length - 1];

      if (ctx.type === 'root') {
        if (text.startsWith('lesson ')) {
          doc.title = text.slice(7).trim();
          continue;
        }
        if (text.startsWith('step ')) {
          cur = { short: text.slice(5).trim(), entries: [] };
          doc.steps.push(cur);
          stack.push({ indent: ind, type: 'step' });
          continue;
        }
      }

      if (ctx.type === 'step' && cur) {
        const entry = parseEntryLine(text);
        if (entry) cur.entries.push(entry);
      }
    }
    return doc;
  }

  function parseEntryLine(text) {
    const m = text.match(/^@(\d+|all)(\+)?(?:\s+L(\d))?(?:[：:]\s*|\s+)(.+)$/);
    if (!m) return null;
    const frameAll = m[1] === 'all';
    return {
      frameMin: frameAll ? -1 : +m[1],
      framePlus: !!m[2],
      frameAll,
      layer: m[3] != null ? +m[3] : 0,
      text: m[4].trim()
    };
  }

  function matchFrame(entry, frameIdx) {
    if (entry.frameAll) return true;
    if (entry.framePlus) return frameIdx >= entry.frameMin;
    return frameIdx === entry.frameMin;
  }

  function findStep(bank, lesson, stepIdx) {
    if (!bank?.steps?.length) return null;
    const short = lesson?.steps?.[stepIdx]?.short;
    if (short) {
      const byName = bank.steps.find(s => s.short === short);
      if (byName) return byName;
    }
    return bank.steps[stepIdx] || null;
  }

  /** 取当前 step/frame/depth 最匹配的旁白；无则返回 null */
  function resolve(bank, lesson, stepIdx, frameIdx, depth) {
    const stepN = findStep(bank, lesson, stepIdx);
    if (!stepN?.entries?.length) return null;

    let best = null;
    let bestScore = -1;
    for (const e of stepN.entries) {
      if (e.layer > depth) continue;
      if (!matchFrame(e, frameIdx)) continue;
      const frameScore = e.frameAll ? 1 : (e.framePlus ? 2 : 3);
      const score = e.layer * 100 + frameScore;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best?.text || null;
  }

  function getDisplayText(bank, lesson, stepIdx, frameIdx, depth, fallbackCap) {
    return resolve(bank, lesson, stepIdx, frameIdx, depth) || fallbackCap || '';
  }

  function splitClauses(text) {
    if (!text || !String(text).trim()) return [];
    const parts = String(text)
      .split(/[|，。！？；\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
    return parts.length ? parts : [String(text).trim()];
  }

  function buildCues(text, durationSec) {
    const clauses = splitClauses(text);
    if (!clauses.length || durationSec <= 0) return [];
    const weights = clauses.map(c => Math.max(1, c.replace(/\s/g, '').length));
    const total = weights.reduce((a, b) => a + b, 0);
    let t = 0;
    const usable = durationSec * 0.96;
    return clauses.map((c, i) => {
      const dur = (weights[i] / total) * usable;
      const cue = { start: t, end: t + dur, text: c };
      t += dur;
      return cue;
    });
  }

  /** 枚举需生成音频的 (step, frame, depth) 片段 */
  function enumerateClips(lesson, narrateBank) {
    const clips = [];
    if (!lesson?.steps) return clips;
    lesson.steps.forEach((step, stepIdx) => {
      for (let frame = 0; frame < step.frames; frame++) {
        for (let depth = 0; depth < 3; depth++) {
          const cap = step.captions?.[depth] || '';
          const text = getDisplayText(narrateBank, lesson, stepIdx, frame, depth, cap);
          if (!text.trim()) continue;
          clips.push({
            key: `${stepIdx}-${frame}-${depth}`,
            step: stepIdx,
            frame,
            depth,
            text
          });
        }
      }
    });
    return clips;
  }

  function getClip(manifest, step, frame, depth) {
    if (!manifest?.clips) return null;
    return manifest.clips[`${step}-${frame}-${depth}`] || null;
  }

  global.NarrateDSL = {
    parse: parseNarrate,
    resolve,
    getDisplayText,
    findStep,
    matchFrame,
    splitClauses,
    buildCues,
    enumerateClips,
    getClip
  };
})(typeof window !== 'undefined' ? window : globalThis);
