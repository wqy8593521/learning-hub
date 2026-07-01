/**
 * 课程播放状态机 — 无 DOM 依赖
 */
function createLessonEngine({ lesson, quizBank, narrateBank, lessonId, options = {} }) {
  const scenes = VML.lessonToScenes(lesson);
  const speeds = [0.25, 0.5, 0.75, 1, 1.5, 2];
  let depth = 0;
  let flatPos = 0;
  let playing = true;
  let manual = false;
  let speed = 1;
  const flatMap = [];
  scenes.forEach((sc, si) => {
    for (let f = 0; f < sc.frames; f++) flatMap.push({ step: si, frame: f });
  });
  const quizDoneSteps = new Set();
  let endQuizDone = false;
  const seed = options.seed ?? Math.floor(Math.random() * 1e9);

  function resolveQuizMode() {
    if (options.quiz === false || !quizBank) return 'off';
    if (typeof location !== 'undefined') {
      const q = new URLSearchParams(location.search).get('quiz');
      if (q === 'off' || q === '0') return 'off';
      if (q === 'step') return 'step';
      if (q === 'end') return 'end';
      if (q === 'all') return 'all';
    }
    if (globalThis.HubPrefs) {
      const mode = HubPrefs.load().quizMode;
      if (mode) return mode;
    }
    return 'all';
  }

  function pos() { return flatMap[flatPos]; }

  function formatSpeed(s) {
    const n = s < 1 ? parseFloat(s.toFixed(2)) : s;
    return n + '×';
  }

  function formatFrameLabel() {
    const { step, frame } = pos();
    const sc = scenes[step];
    const modeTag = manual ? ' · 手动' : (playing ? '' : ' · 暂停');
    return `步骤 ${step + 1}/${scenes.length} · 帧 ${frame + 1}/${sc.frames} · L${depth}${modeTag}`;
  }

  function pickForTrigger(trigger, salt) {
    return QuizDSL.pickForTrigger(quizBank, trigger, lessonId, seed + salt);
  }

  function getStepTrigger(step) {
    if (!quizBank) return null;
    return quizBank.triggers.find(t => t.type === 'after_step' && t.step === step) || null;
  }

  function getEndTrigger() {
    if (!quizBank) return null;
    return quizBank.triggers.find(t => t.type === 'end') || null;
  }

  function shouldAutoQuizStep(step) {
    const mode = resolveQuizMode();
    if (mode === 'off' || mode === 'end') return false;
    if (quizDoneSteps.has(step)) return false;
    return !!getStepTrigger(step);
  }

  function shouldAutoQuizEnd() {
    const mode = resolveQuizMode();
    if (mode === 'off' || mode === 'step') return false;
    if (endQuizDone) return false;
    return !!getEndTrigger();
  }

  function quizForStep(step) {
    const trigger = getStepTrigger(step);
    if (!trigger) return [];
    return pickForTrigger(trigger, step);
  }

  function quizForEnd() {
    const trigger = getEndTrigger();
    if (!trigger) return [];
    return pickForTrigger(trigger, 99);
  }

  function markStepQuizDone(step) { quizDoneSteps.add(step); }
  function markEndQuizDone() { endQuizDone = true; }

  function finishAdvance() {
    if (shouldAutoQuizEnd()) {
      endQuizDone = true;
      return { type: 'quiz_end', questions: quizForEnd() };
    }
    playing = false;
    return { type: 'finished' };
  }

  function advance() {
    const { step, frame } = pos();
    const sc = scenes[step];
    const lastFrame = frame === sc.frames - 1;

    if (lastFrame) {
      if (shouldAutoQuizStep(step)) {
        const questions = quizForStep(step);
        quizDoneSteps.add(step);
        return { type: 'quiz_step', step, questions, after: flatPos < flatMap.length - 1 ? 'continue' : 'finish' };
      }
      if (flatPos < flatMap.length - 1) {
        flatPos++;
        return { type: 'draw' };
      }
      return finishAdvance();
    }
    if (flatPos < flatMap.length - 1) {
      flatPos++;
      return { type: 'draw' };
    }
    return finishAdvance();
  }

  function stepBy(delta) {
    if (delta < 0) {
      if (flatPos > 0) { flatPos--; return { type: 'draw' }; }
      return { type: 'noop' };
    }
    return advance();
  }

  function restart() {
    flatPos = 0;
    quizDoneSteps.clear();
    endQuizDone = false;
    if (manual) {
      playing = false;
      return { type: 'draw', playing: false };
    }
    playing = true;
    return { type: 'draw', playing: true };
  }

  function continueAfterStepQuiz() {
    if (flatPos < flatMap.length - 1) {
      flatPos++;
      return { type: 'draw' };
    }
    return finishAdvance();
  }

  function flatIndexForStep(stepIdx) {
    let n = 0;
    for (let i = 0; i < stepIdx; i++) n += scenes[i].frames;
    return n;
  }

  function getCaption(step, frame, depth) {
    const cap = scenes[step]?.captions?.[depth] ?? '';
    if (narrateBank && globalThis.NarrateDSL) {
      return NarrateDSL.getDisplayText(narrateBank, lesson, step, frame, depth, cap);
    }
    return cap;
  }

  function getCapOnly(step, depth) {
    return scenes[step]?.captions?.[depth] ?? '';
  }

  function hasNarrate(step, frame, depth) {
    if (!narrateBank || !globalThis.NarrateDSL) return false;
    return !!NarrateDSL.resolve(narrateBank, lesson, step, frame, depth);
  }

  return {
    lesson,
    narrateBank,
    scenes,
    speeds,
    get state() {
      return { depth, flatPos, playing, manual, speed, total: flatMap.length };
    },
    pos,
    formatSpeed,
    formatFrameLabel,
    resolveQuizMode,
    getStepTrigger,
    quizForStep,
    quizForEnd,
    markStepQuizDone,
    markEndQuizDone,
    setDepth(d) { depth = d; return { type: 'draw' }; },
    setFlatPos(p) { flatPos = Math.max(0, Math.min(flatMap.length - 1, p)); return { type: 'draw' }; },
    setPlaying(p) { playing = p; },
    setManual(m) { manual = m; },
    setSpeed(s) { speed = s; },
    stepBy,
    advance,
    restart,
    continueAfterStepQuiz,
    flatIndexForStep,
    getCaption,
    getCapOnly,
    hasNarrate,
    tickInterval() { return 1400 / speed; }
  };
}
