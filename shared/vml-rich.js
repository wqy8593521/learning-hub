/**
 * VML 富文本后处理 — 代码高亮、KaTeX 公式
 * 在 vml.js 之后加载
 */
(function (global) {
  let katexPromise = null;

  function loadKaTeX() {
    if (global.katex) return Promise.resolve();
    if (katexPromise) return katexPromise;
    katexPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('KaTeX load failed'));
      document.head.appendChild(s);
    });
    return katexPromise;
  }

  const JAVA_KW = /\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|String)\b/g;
  const JAVA_STR = /("(?:[^"\\]|\\.)*")/g;
  const JAVA_CM = /(\/\/[^\n]*)/g;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightCode(src, lang) {
    if (global.CodeHighlight) return CodeHighlight.highlightCode(src, lang);
    let s = esc(String(src).replace(/\\n/g, '\n'));
    if (!lang || lang === 'java') {
      s = s.replace(JAVA_STR, '<span class="vml-str">$1</span>');
      s = s.replace(JAVA_CM, '<span class="vml-cm">$1</span>');
      s = s.replace(JAVA_KW, '<span class="vml-kw">$1</span>');
    }
    return s;
  }

  function enrichSvg(svgEl) {
    if (!svgEl) return Promise.resolve();
    const mathEls = svgEl.querySelectorAll('.vml-math[data-tex]');
    if (!mathEls.length) return Promise.resolve();
    return loadKaTeX().then(() => {
      mathEls.forEach(el => {
        try {
          global.katex.render(el.dataset.tex, el, { throwOnError: false, displayMode: el.classList.contains('block') });
        } catch (_) { /* keep fallback text */ }
      });
    }).catch(() => { /* offline: show plain text */ });
  }

  global.VMLRich = { highlightCode, enrichSvg, loadKaTeX };
})(typeof window !== 'undefined' ? window : globalThis);
