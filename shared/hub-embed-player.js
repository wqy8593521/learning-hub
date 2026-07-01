/**
 * 首页内嵌课程播放器
 */
const HubEmbedPlayer = {
  transport: null,
  currentId: null,
  _loadGen: 0,

  init() {
    this.shell = document.getElementById('playerShell');
    if (!this.shell) return;

    this.els = {
      svgEl: document.getElementById('embedSvg'),
      captionEl: document.getElementById('embedCaption'),
      timelineEl: document.getElementById('embedTimeline'),
      stepLabelsEl: document.getElementById('embedStepLabels'),
      timeMarksEl: document.getElementById('embedTimeMarks'),
      playBtn: document.getElementById('embedPlayBtn'),
      speedBtn: document.getElementById('embedSpeedBtn'),
      frameIndEl: document.getElementById('embedFrameInd'),
      restartBtn: document.getElementById('embedRestartBtn'),
      depthBtns: document.querySelectorAll('#playerShell .depth-btn'),
      quizLayerEl: document.getElementById('embedQuizLayer'),
      viewportEl: document.getElementById('embedViewport'),
      fullscreenBtn: document.getElementById('embedFullscreenBtn'),
      modeBtn: document.getElementById('embedModeBtn'),
      prevBtn: document.getElementById('embedPrevBtn'),
      nextBtn: document.getElementById('embedNextBtn'),
      codePanelEl: document.getElementById('embedCodePanel'),
      codeBodyEl: document.getElementById('embedCodeBody'),
      codeLangEl: document.getElementById('embedCodeLang'),
      codeCopyBtn: document.getElementById('embedCodeCopy'),
      quizModeBtn: document.getElementById('embedQuizModeBtn'),
      quizBtn: document.getElementById('embedQuizBtn'),
      narrateBtn: document.getElementById('embedNarrateBtn')
    };
  },

  showPlaceholder() {
    this._loadGen++;
    this.stopActive();
    this.currentId = null;
    document.body.classList.remove('has-lesson');
    document.getElementById('lessonView')?.setAttribute('hidden', '');
    document.getElementById('docWrap')?.removeAttribute('hidden');
    this.setRailActive(null);
  },

  stopActive() {
    if (this.transport) {
      this.transport.destroy();
      this.transport = null;
    }
    this.resetDom();
  },

  resetDom() {
    const { svgEl, quizLayerEl, codePanelEl, codeBodyEl, captionEl, stepLabelsEl, timeMarksEl, viewportEl } = this.els || {};
    if (viewportEl) viewportEl.classList.remove('has-code', 'is-fullscreen');
    if (svgEl) while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    if (quizLayerEl) {
      quizLayerEl.classList.remove('show');
      quizLayerEl.innerHTML = '';
    }
    if (codePanelEl) codePanelEl.hidden = true;
    if (codeBodyEl) codeBodyEl.innerHTML = '';
    if (captionEl) captionEl.innerHTML = '';
    if (stepLabelsEl) stepLabelsEl.innerHTML = '';
    if (timeMarksEl) timeMarksEl.innerHTML = '';
  },

  setRailActive(id) {
    document.querySelectorAll('.vp-sidebar-lesson').forEach(a => {
      a.classList.toggle('active', id && a.dataset.lesson === id);
    });
  },

  async open(lesson) {
    if (!this.shell || !lesson?.dsl) return;
    if (this.currentId === lesson.id && this.transport) return;

    const gen = ++this._loadGen;
    this.stopActive();
    this.currentId = lesson.id;
    document.body.classList.add('has-lesson');
    document.getElementById('docWrap')?.setAttribute('hidden', '');
    document.getElementById('lessonView')?.removeAttribute('hidden');
    this.setRailActive(lesson.id);

    try {
      const transport = await loadLearnLesson(lesson.dsl, {
        lessonId: lesson.id,
        ...this.els
      });
      if (gen !== this._loadGen) {
        transport?.destroy();
        return;
      }
      this.transport = transport;
    } catch (err) {
      if (gen !== this._loadGen) return;
      console.error(err);
    }
  }
};
