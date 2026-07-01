/**
 * 旁白 — 预生成 MP3（P2）+ Web Speech 回退（P0）
 */
function createLessonNarrator(opts = {}) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  let audioEl = null;
  let utter = null;
  let clauseTimer = null;
  let rafId = null;
  let session = 0;
  let speaking = false;

  const audioManifest = opts.audioManifest || null;
  const baseUrl = opts.baseUrl || '';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function hasPrebuiltAudio() {
    return !!(audioManifest?.clips && Object.keys(audioManifest.clips).length);
  }

  function isSupported() {
    return hasPrebuiltAudio() || (!!synth && typeof SpeechSynthesisUtterance !== 'undefined');
  }

  function narrateEnabled() {
    if (!globalThis.HubPrefs) return false;
    return HubPrefs.load().narrate === 'on';
  }

  function splitClauses(text) {
    if (globalThis.NarrateDSL?.splitClauses) return NarrateDSL.splitClauses(text);
    if (!text || !String(text).trim()) return [];
    const parts = String(text)
      .split(/[|，。！？；\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
    return parts.length ? parts : [String(text).trim()];
  }

  function renderCaptionHtml(clauses, activeIdx) {
    if (!clauses.length) return '';
    return clauses.map((c, i) => {
      let cls = 'caption-clause';
      if (i === activeIdx) cls += ' on';
      else if (i < activeIdx) cls += ' done';
      return `<span class="${cls}">${esc(c)}</span>`;
    }).join('<span class="caption-gap"> </span>');
  }

  function resolveClip(step, frame, depth) {
    if (!audioManifest || !globalThis.NarrateDSL) return null;
    return NarrateDSL.getClip(audioManifest, step, frame, depth);
  }

  function pickVoice() {
    if (!synth) return null;
    const voices = synth.getVoices();
    return voices.find(v => v.lang.startsWith('zh')) ||
      voices.find(v => /chinese|tingting|meijia/i.test(v.name)) ||
      null;
  }

  function cancel() {
    session++;
    speaking = false;
    if (clauseTimer) { clearTimeout(clauseTimer); clauseTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (synth) synth.cancel();
    if (audioEl) {
      audioEl.onended = null;
      audioEl.ontimeupdate = null;
      audioEl.pause();
      audioEl.src = '';
      audioEl = null;
    }
    utter = null;
  }

  function estimateMs(text, rate) {
    const chars = String(text).replace(/\s/g, '').length;
    return Math.max(700, (chars / 4.2) * 1000 / Math.max(0.5, rate));
  }

  function activeCueIndex(clip, time) {
    const cues = clip.cues || [];
    let idx = 0;
    for (let i = 0; i < cues.length; i++) {
      if (time >= cues[i].start) idx = i;
    }
    return idx;
  }

  function speakAudio(clip, opts) {
    const { rate = 1, onClause, onEnd } = opts;
    const id = ++session;
    const cues = clip.cues?.length
      ? clip.cues
      : splitClauses(clip.text).map((text, i, arr) => ({
        text,
        start: (clip.duration || 3) * (i / arr.length),
        end: (clip.duration || 3) * ((i + 1) / arr.length)
      }));

    return new Promise(resolve => {
      const audio = new Audio(baseUrl + clip.audio);
      audio.playbackRate = Math.max(0.5, Math.min(2, rate));
      audioEl = audio;
      speaking = true;

      const clauseTexts = cues.map(c => c.text);
      onClause?.(0, clauseTexts);

      const tick = () => {
        if (id !== session || !audioEl) return;
        const idx = activeCueIndex({ cues }, audio.currentTime);
        onClause?.(idx, clauseTexts);
        if (!audio.paused && !audio.ended) {
          rafId = requestAnimationFrame(tick);
        }
      };

      audio.onplay = () => { rafId = requestAnimationFrame(tick); };
      audio.onended = () => {
        if (id !== session) return;
        speaking = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        onClause?.(clauseTexts.length - 1, clauseTexts);
        onEnd?.();
        resolve();
      };
      audio.onerror = () => {
        if (id !== session) return;
        speaking = false;
        onEnd?.();
        resolve();
      };

      audio.play().catch(() => {
        speaking = false;
        onEnd?.();
        resolve();
      });
    });
  }

  function speakSynth(text, opts) {
    const { rate = 1, onClause, onEnd } = opts;
    const id = ++session;
    const clauses = splitClauses(text);

    if (!clauses.length) {
      onEnd?.();
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const fullText = clauses.join('，');
      utter = new SpeechSynthesisUtterance(fullText);
      utter.lang = 'zh-CN';
      utter.rate = Math.max(0.5, Math.min(2, rate));

      const applyVoice = () => {
        const v = pickVoice();
        if (v) utter.voice = v;
      };
      applyVoice();
      if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = () => { applyVoice(); };
      }

      speaking = true;
      let clauseIdx = 0;
      onClause?.(clauseIdx, clauses);

      function scheduleClauses() {
        if (clauseIdx >= clauses.length - 1) return;
        const ms = estimateMs(clauses[clauseIdx], utter.rate);
        clauseTimer = setTimeout(() => {
          if (id !== session) return;
          clauseIdx++;
          onClause?.(clauseIdx, clauses);
          scheduleClauses();
        }, ms);
      }
      scheduleClauses();

      const finish = () => {
        if (id !== session) return;
        speaking = false;
        if (clauseTimer) { clearTimeout(clauseTimer); clauseTimer = null; }
        onClause?.(clauses.length - 1, clauses);
        onEnd?.();
        resolve();
      };

      utter.onend = finish;
      utter.onerror = finish;
      synth.speak(utter);
    });
  }

  function speak(text, opts = {}) {
    cancel();

    if (!narrateEnabled() || !isSupported()) {
      opts.onEnd?.();
      return Promise.resolve();
    }

    const { step, frame, depth } = opts;
    const clip = (step != null && hasPrebuiltAudio())
      ? resolveClip(step, frame, depth)
      : null;

    if (clip?.audio) {
      return speakAudio(clip, opts);
    }
    return speakSynth(text, opts);
  }

  return {
    speak,
    cancel,
    splitClauses,
    renderCaptionHtml,
    isSupported,
    narrateEnabled,
    hasPrebuiltAudio,
    get speaking() { return speaking; }
  };
}
