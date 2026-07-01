/**
 * 画布视口 — SVG 动画 + 独立代码面板
 */
function createLessonViewport({ svgEl, codePanelEl, codeBodyEl, codeLangEl, codeCopyBtn, viewportEl }) {
  function codePanelMode() {
    if (!globalThis.HubPrefs) return 'auto';
    return HubPrefs.load().codePanel || 'auto';
  }

  function shouldShowCodePanel(block, depth) {
    const mode = codePanelMode();
    if (mode === 'never') return false;
    if (mode === 'always') return !!block;
    return !!block && depth >= 1;
  }

  function updateCodePanel(block, depth) {
    if (!codePanelEl || !codeBodyEl) return;
    const show = shouldShowCodePanel(block, depth);
    codePanelEl.hidden = !show;
    if (viewportEl) viewportEl.classList.toggle('has-code', show);
    if (!show || !block) {
      if (codeBodyEl) codeBodyEl.innerHTML = '';
      return;
    }
    const lang = block.lang || 'java';
    if (codeLangEl) codeLangEl.textContent = lang === 'java' ? 'Java' : lang;
    const render = globalThis.CodeHighlight?.renderCodeLines;
    if (render) {
      codeBodyEl.innerHTML = render(block.lines || [], block.highlight, lang);
    } else {
      codeBodyEl.innerHTML = (block.lines || []).map((ln, i) =>
        `<div class="code-line${i === block.highlight ? ' hl' : ''}"><span class="code-ln">${i + 1}</span><code>${ln}</code></div>`
      ).join('');
    }
    if (codeCopyBtn) {
      codeCopyBtn.onclick = () => {
        const fmt = globalThis.CodeHighlight?.formatForCopy;
        const text = fmt ? fmt(block.lines || [], lang) : (block.lines || []).join('\n');
        navigator.clipboard?.writeText(text).catch(() => {});
        codeCopyBtn.textContent = '已复制';
        setTimeout(() => { codeCopyBtn.textContent = '复制'; }, 1200);
      };
    }
  }

  function render(engine) {
    const { step, frame } = engine.pos();
    const sc = engine.scenes[step];
    const depth = engine.state.depth;
    const lesson = engine.lesson;
    const skipCode = codePanelMode() !== 'never';
    const renderOpts = skipCode ? { skipTypes: ['codeblock'] } : {};
    svgEl.innerHTML = sc.render(depth, frame, renderOpts);
    if (globalThis.VMLRich?.enrichSvg) VMLRich.enrichSvg(svgEl);

    const block = VML.extractCodeblock?.(lesson, depth, frame, step) || null;
    updateCodePanel(block, depth);
  }

  return { render, updateCodePanel, shouldShowCodePanel };
}
