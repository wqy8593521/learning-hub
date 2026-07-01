/**
 * 统一播放器 — 编排 engine / viewport / transport / quiz
 */
function initLessonPlayer(opts) {
  const {
    lesson, quizBank, lessonId, titleEl, svgEl, captionEl, timelineEl, stepLabelsEl,
    timeMarksEl, playBtn, speedBtn, frameIndEl, restartBtn, depthBtns,
    quizOverlay, quizLayerEl, stageEl, viewportEl, fullscreenBtn, modeBtn, prevBtn, nextBtn,
    codePanelEl, codeBodyEl, codeLangEl, codeCopyBtn, quizModeBtn, quizBtn
  } = opts;

  const quizLayer = quizLayerEl || quizOverlay;
  const viewportRoot = viewportEl || stageEl;

  if (titleEl && lesson.title) titleEl.textContent = lesson.title;

  const engine = createLessonEngine({
    lesson,
    quizBank,
    narrateBank: opts.narrateBank,
    lessonId,
    options: { quiz: opts.quiz }
  });

  const quiz = createLessonQuiz({ layerEl: quizLayer, lessonId });

  const viewport = createLessonViewport({
    svgEl,
    codePanelEl,
    codeBodyEl,
    codeLangEl,
    codeCopyBtn,
    viewportEl: viewportRoot
  });

  return bindLessonTransport(engine, viewport, {
    captionEl,
    timelineEl,
    stepLabelsEl,
    timeMarksEl,
    playBtn,
    speedBtn,
    frameIndEl,
    restartBtn,
    depthBtns,
    fullscreenBtn,
    modeBtn,
    prevBtn,
    nextBtn,
    quizModeBtn,
    quizBtn,
    narrateBtn: opts.narrateBtn,
    viewportEl: viewportRoot,
    quizLayerEl: quizLayer,
    codePanelEl,
    audioManifest: opts.audioManifest,
    audioBaseUrl: opts.audioBaseUrl,
    quiz,
    onQuizRequest: async () => {
      const { step } = engine.pos();
      let questions = engine.quizForStep(step);
      if (!questions.length) questions = engine.quizForEnd();
      if (!questions.length) return;
      await quiz.show(questions);
      viewport.render(engine);
    }
  });
}

/** @returns {Promise<ReturnType<typeof bindLessonTransport>|undefined>} */
async function loadLearnLesson(url, playerOpts) {
  const res = await fetch(url);
  const lesson = VML.parse(await res.text());
  const baseUrl = url.replace(/[^/]+$/, '');
  let quizBank = null;
  let narrateBank = null;
  let audioManifest = null;
  const quizUrl = url.replace(/\.learn$/, '.quiz');
  const narrateUrl = url.replace(/\.learn$/, '.narrate');
  const audioManifestUrl = baseUrl + 'audio/narrate.json';
  try {
    const qr = await fetch(quizUrl);
    if (qr.ok) quizBank = QuizDSL.parse(await qr.text());
  } catch (_) {}
  try {
    const nr = await fetch(narrateUrl);
    if (nr.ok) narrateBank = NarrateDSL.parse(await nr.text());
  } catch (_) {}
  try {
    const ar = await fetch(audioManifestUrl);
    if (ar.ok) audioManifest = await ar.json();
  } catch (_) {}
  return initLessonPlayer({
    ...playerOpts,
    lesson,
    quizBank,
    narrateBank,
    audioManifest,
    audioBaseUrl: baseUrl
  });
}
