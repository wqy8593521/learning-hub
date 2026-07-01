/**
 * 代码语法高亮 — HTML 片段，供代码面板与 VML 富文本共用
 */
(function (global) {
  const JAVA_KW = /\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|String)\b/g;
  const JAVA_STR = /("(?:[^"\\]|\\.)*")/g;
  const JAVA_CM = /(\/\/[^\n]*)/g;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function normalizeJavaOps(s) {
    return s
      .replace(/^if\(/i, 'if (')
      .replace(/^while\(/i, 'while (')
      .replace(/^for\(/i, 'for (')
      .replace(/==/g, ' == ')
      .replace(/!=/g, ' != ')
      .replace(/<=/g, ' <= ')
      .replace(/>=/g, ' >= ')
      .replace(/,(\S)/g, ', $1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function ensureSemi(s) {
    const t = s.trim();
    if (!t || t.endsWith(';') || t.endsWith('{') || t.endsWith('}')) return t;
    return t + ';';
  }

  /** 将 .learn 简写行格式化为可读的 Java 代码块 */
  function formatJavaLines(lines, highlightIdx = 0) {
    const raw = lines.map(l => String(l).trim()).filter(Boolean);
    const out = [];
    let block = false;
    let hi = highlightIdx;

    for (let i = 0; i < raw.length; i++) {
      const line = raw[i];
      const isIf = /^if\b/i.test(line) || /^if\s*\(/i.test(line);
      if (isIf) {
        let s = normalizeJavaOps(line);
        if (!/\{\s*$/.test(s)) s = s.replace(/\)\s*$/, ') {');
        block = true;
        out.push(s);
        continue;
      }
      const stmt = ensureSemi(normalizeJavaOps(line));
      out.push(block ? '    ' + stmt : stmt);
    }
    if (block) out.push('}');
    if (hi >= out.length) hi = out.length - 1;
    return { lines: out, highlight: hi };
  }

  function highlightCode(src, lang) {
    let s = esc(String(src).replace(/\\n/g, '\n'));
    if (!lang || lang === 'java') {
      s = s.replace(JAVA_STR, '<span class="vml-str">$1</span>');
      s = s.replace(JAVA_CM, '<span class="vml-cm">$1</span>');
      s = s.replace(JAVA_KW, '<span class="vml-kw">$1</span>');
    }
    return s;
  }

  function renderCodeLines(lines, highlight, lang) {
    const hi = global.VMLRich?.highlightCode || highlightCode;
    let display = lines;
    let hl = highlight;
    if (!lang || lang === 'java') {
      const fmt = formatJavaLines(lines, highlight);
      display = fmt.lines;
      hl = fmt.highlight;
    }
    return display.map((line, i) => {
      const cls = i === hl ? 'code-line hl' : 'code-line';
      return `<div class="${cls}"><span class="code-ln">${i + 1}</span><code>${hi(line, lang)}</code></div>`;
    }).join('');
  }

  function formatForCopy(lines, lang) {
    if (!lang || lang === 'java') return formatJavaLines(lines).lines.join('\n');
    return lines.join('\n');
  }

  global.CodeHighlight = { highlightCode, renderCodeLines, formatJavaLines, formatForCopy, esc };
})(typeof window !== 'undefined' ? window : globalThis);
