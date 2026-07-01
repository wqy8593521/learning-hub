/**
 * 播放控制器 — 按钮、快捷键、全屏、旁白
 */
function bindLessonTransport(engine, viewport, refs) {
  const {
    captionEl, timelineEl, stepLabelsEl, timeMarksEl, playBtn, speedBtn, frameIndEl,
    restartBtn, depthBtns, fullscreenBtn, modeBtn, prevBtn, nextBtn, quizModeBtn, quizBtn,
    narrateBtn, viewportEl, quizLayerEl
  } = refs;

  const narrator = refs.narrator || createLessonNarrator({
    audioManifest: refs.audioManifest,
    baseUrl: refs.audioBaseUrl || ''
  });
  let timer = null;
  let advancing = false;
  let narrateKey = '';

  const QUIZ_LABELS = { off: '关', step: '步末', end: '期末', all: '全开' };
  const QUIZ_CYCLE = ['off', 'step', 'end', 'all'];
  const hasQuiz = !!refs.quiz;

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function stopNarration() {
    narrator.cancel();
    narrateKey = '';
  }

  function useNarrate() {
    return narrator.narrateEnabled() && narrator.isSupported();
  }

  function startPlayback() {
    stopTimer();
    if (!engine.state.manual && engine.state.playing) {
      if (useNarrate()) maybeNarrate();
      else startTimer();
    }
  }

  function startTimer() {
    stopTimer();
    if (!engine.state.manual && engine.state.playing && !useNarrate()) {
      timer = setInterval(() => handleAdvance(), engine.tickInterval());
    }
  }

  function updateCaption(text, activeClause) {
    if (!captionEl) return;
    if (!useNarrate()) {
      captionEl.textContent = text;
      return;
    }
    const clauses = narrator.splitClauses(text);
    captionEl.innerHTML = narrator.renderCaptionHtml(clauses, activeClause ?? -1);
  }

  function syncNarrateBtn() {
    if (!narrateBtn) return;
    const on = narrator.narrateEnabled();
    narrateBtn.classList.toggle('on', on);
    narrateBtn.title = on
      ? (narrator.hasPrebuiltAudio()
        ? '旁白开：预生成语音 (N)'
        : '旁白开：浏览器朗读 (N)')
      : (narrator.isSupported() ? '旁白关 (N)' : '无可用语音');
    narrateBtn.disabled = !narrator.isSupported();
    narrateBtn.textContent = on ? '🔊' : '🔇';
  }

  function syncTransport() {
    const { manual, playing, speed } = engine.state;
    if (modeBtn) {
      modeBtn.textContent = manual ? '手动' : '自动';
      modeBtn.classList.toggle('on', manual);
      modeBtn.title = manual ? '当前手动逐帧，点击切自动' : '当前自动播放，点击切手动';
    }
    if (playBtn) playBtn.style.display = manual ? 'none' : '';
    if (speedBtn) {
      speedBtn.style.display = manual ? 'none' : '';
      speedBtn.textContent = engine.formatSpeed(speed);
    }
    if (prevBtn) prevBtn.style.display = manual ? '' : 'none';
    if (nextBtn) nextBtn.style.display = manual ? '' : 'none';
    if (playBtn && !manual) playBtn.textContent = playing ? '⏸' : '▶';
    if (quizModeBtn) {
      const mode = engine.resolveQuizMode();
      quizModeBtn.textContent = '模式 ' + (QUIZ_LABELS[mode] || mode);
      quizModeBtn.title = '切换自动测验：关 / 步末 / 期末 / 全开';
    }
    if (quizBtn) {
      quizBtn.style.display = hasQuiz ? '' : 'none';
      quizBtn.disabled = !hasQuiz;
    }
    syncNarrateBtn();
  }

  function currentCaption() {
    const { step, frame } = engine.pos();
    return engine.getCaption(step, frame, engine.state.depth);
  }

  function captionForDisplay() {
    const { step, frame } = engine.pos();
    const depth = engine.state.depth;
    if (useNarrate()) return engine.getCaption(step, frame, depth);
    return engine.getCapOnly(step, depth);
  }

  function maybeNarrate() {
    if (!useNarrate() || engine.state.manual || !engine.state.playing) return;
    if (refs.quiz?.isOpen()) return;

    const key = `${engine.state.flatPos}-${engine.state.depth}`;
    if (key === narrateKey && narrator.speaking) return;
    narrateKey = key;

    const text = currentCaption();
    const clauses = narrator.splitClauses(text);
    updateCaption(text, 0);

    const { step, frame } = engine.pos();
    const depth = engine.state.depth;
    const flatAtStart = engine.state.flatPos;
    narrator.speak(text, {
      step,
      frame,
      depth,
      rate: engine.state.speed,
      onClause: (i) => updateCaption(text, i),
      onEnd: () => {
        if (!engine.state.playing || engine.state.manual) return;
        if (engine.state.flatPos !== flatAtStart) return;
        handleAdvance();
      }
    });
  }

  function syncUI() {
    const { step, frame } = engine.pos();
    const sc = engine.scenes[step];
    const { depth, flatPos } = engine.state;

    viewport.render(engine);
    updateCaption(captionForDisplay(), useNarrate() && narrator.speaking ? undefined : -1);
    if (frameIndEl) frameIndEl.textContent = engine.formatFrameLabel();
    if (timelineEl) timelineEl.value = flatPos;
    if (stepLabelsEl) {
      stepLabelsEl.innerHTML = engine.scenes.map((s, i) =>
        `<div class="step-chip ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}" data-s="${i}">${s.short}</div>`
      ).join('');
      stepLabelsEl.querySelectorAll('.step-chip').forEach(el => {
        el.onclick = () => {
          stopNarration();
          engine.setFlatPos(engine.flatIndexForStep(+el.dataset.s));
          draw();
        };
      });
    }
    syncTransport();
  }

  function draw() { syncUI(); }

  async function runQuiz(result) {
    stopTimer();
    stopNarration();
    const resumePlayback = !engine.state.manual && engine.state.playing;
    engine.setPlaying(false);
    draw();
    if (result.questions?.length && refs.quiz) {
      await refs.quiz.show(result.questions);
    }
    if (result.type === 'quiz_step') {
      const next = engine.continueAfterStepQuiz();
      if (next.type === 'draw') {
        if (resumePlayback) engine.setPlaying(true);
        draw();
        if (resumePlayback) startPlayback();
      } else {
        await handleResult(next);
      }
      return;
    }
    if (result.type === 'quiz_end') {
      draw();
      stopTimer();
    }
  }

  async function handleResult(result) {
    if (result.type === 'draw') {
      stopNarration();
      draw();
      if (engine.state.playing && !engine.state.manual) startPlayback();
      return;
    }
    if (result.type === 'quiz_step' || result.type === 'quiz_end') {
      await runQuiz(result);
      return;
    }
    if (result.type === 'finished') {
      stopNarration();
      draw();
      stopTimer();
    }
  }

  async function handleAdvance() {
    if (advancing || refs.quiz?.isOpen()) return;
    advancing = true;
    try {
      await handleResult(engine.advance());
    } finally {
      advancing = false;
    }
  }

  function stepBy(delta) {
    stopNarration();
    if (delta < 0) {
      const r = engine.stepBy(-1);
      if (r.type === 'draw') draw();
      return;
    }
    if (engine.state.manual) {
      handleAdvance();
    } else {
      engine.setPlaying(false);
      stopTimer();
      handleAdvance();
    }
  }

  function toggleNarrate() {
    if (!narrator.isSupported() || !globalThis.HubPrefs) return;
    const on = HubPrefs.load().narrate !== 'on';
    HubPrefs.save({ ...HubPrefs.load(), narrate: on ? 'on' : 'off' });
    syncNarrateBtn();
    if (on && engine.state.playing && !engine.state.manual) {
      narrateKey = '';
      maybeNarrate();
    } else {
      stopNarration();
      updateCaption(currentCaption(), -1);
      if (engine.state.playing && !engine.state.manual) startPlayback();
    }
  }

  if (timelineEl) {
    timelineEl.max = engine.state.total - 1;
    timelineEl.oninput = () => {
      stopNarration();
      engine.setFlatPos(+timelineEl.value);
      if (!engine.state.manual) {
        engine.setPlaying(false);
        stopTimer();
      }
      draw();
    };
  }

  if (modeBtn) modeBtn.onclick = () => {
    const manual = !engine.state.manual;
    engine.setManual(manual);
    if (manual) { engine.setPlaying(false); stopTimer(); stopNarration(); }
    else { engine.setPlaying(true); startPlayback(); }
    draw();
  };
  if (prevBtn) prevBtn.onclick = () => stepBy(-1);
  if (nextBtn) nextBtn.onclick = () => stepBy(1);
  if (playBtn) playBtn.onclick = () => {
    if (engine.state.manual) return;
    const willPlay = !engine.state.playing;
    engine.setPlaying(willPlay);
    if (!willPlay) { stopTimer(); stopNarration(); }
    draw();
    if (willPlay) startPlayback();
  };
  if (speedBtn) speedBtn.onclick = () => {
    if (engine.state.manual) return;
    const i = engine.speeds.indexOf(engine.state.speed);
    engine.setSpeed(engine.speeds[(i + 1) % engine.speeds.length]);
    speedBtn.textContent = engine.formatSpeed(engine.state.speed);
    if (engine.state.playing) startPlayback();
  };
  if (restartBtn) restartBtn.onclick = () => {
    stopNarration();
    const r = engine.restart();
    draw();
    if (r.playing) startPlayback();
    else stopTimer();
  };
  if (depthBtns) depthBtns.forEach(btn => {
    btn.onclick = () => {
      stopNarration();
      narrateKey = '';
      depthBtns.forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      engine.setDepth(+btn.dataset.d);
      draw();
      if (engine.state.playing && !engine.state.manual && useNarrate()) maybeNarrate();
    };
  });
  if (timeMarksEl) timeMarksEl.textContent = engine.scenes.map(s => s.short).join(' · ');

  if (quizModeBtn) quizModeBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = engine.resolveQuizMode();
    const i = Math.max(0, QUIZ_CYCLE.indexOf(cur));
    const next = QUIZ_CYCLE[(i + 1) % QUIZ_CYCLE.length];
    if (globalThis.HubPrefs) HubPrefs.save({ ...HubPrefs.load(), quizMode: next });
    syncTransport();
  };

  if (quizBtn) quizBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!refs.onQuizRequest) return;
    stopTimer();
    stopNarration();
    engine.setPlaying(false);
    await refs.onQuizRequest();
    draw();
  };

  if (narrateBtn) narrateBtn.onclick = (e) => {
    e.preventDefault();
    toggleNarrate();
  };

  bindFullscreen(viewportEl, fullscreenBtn);

  document.addEventListener('keydown', onKey);
  function onKey(e) {
    if (e.target.matches('input, textarea, select') || quizLayerEl?.classList.contains('show')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); stepBy(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepBy(-1); }
    if (e.key === ' ') { e.preventDefault(); if (!engine.state.manual && playBtn) playBtn.click(); }
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); modeBtn?.click(); }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); toggleNarrate(); }
    if (e.key === 'c' || e.key === 'C') {
      if (globalThis.HubPrefs && refs.codePanelEl) {
        const p = HubPrefs.load();
        const cycle = { never: 'auto', auto: 'always', always: 'never' };
        HubPrefs.save({ ...p, codePanel: cycle[p.codePanel || 'auto'] || 'auto' });
        draw();
      }
    }
  }

  function onPrefsChange() {
    syncNarrateBtn();
    draw();
  }
  window.addEventListener('hubprefschange', onPrefsChange);

  draw();
  syncTransport();
  startPlayback();

  return {
    draw,
    stopTimer,
    startTimer: startPlayback,
    handleAdvance,
    destroy() {
      engine.setPlaying(false);
      stopTimer();
      stopNarration();
      if (viewportEl && document.fullscreenElement === viewportEl) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      }
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hubprefschange', onPrefsChange);
    }
  };
}

function bindFullscreen(viewportEl, btn) {
  if (!viewportEl || !btn) return;
  const sync = () => {
    const on = !!document.fullscreenElement;
    viewportEl.classList.toggle('is-fullscreen', on);
    btn.classList.toggle('on', on);
    btn.title = on ? '退出全屏 (Esc)' : '全屏';
    btn.textContent = on ? '⤢' : '⛶';
  };
  btn.onclick = () => {
    if (!document.fullscreenElement) {
      const req = viewportEl.requestFullscreen || viewportEl.webkitRequestFullscreen;
      if (req) req.call(viewportEl);
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  };
  document.addEventListener('fullscreenchange', sync);
  sync();
}
