#!/usr/bin/env node
// 为 library 下各课 index.html 注入旁白相关脚本
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'library');

const NARRATE_PARSE =
  '  <script src="../../shared/narrate-parse.js"></script>\n';
const NARRATOR_SCRIPT =
  '  <script src="../../shared/lesson-narrator.js"></script>\n';
const NARRATE_BTN =
  '          <button class="btn btn-narrate" id="narrateBtn" type="button" title="旁白 (N)">🔇</button>\n';
const NARRATE_OPT =
  '      narrateBtn: document.getElementById(\'narrateBtn\')\n';

let n = 0;
for (const dir of fs.readdirSync(LIB, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const file = path.join(LIB, dir.name, 'index.html');
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (!html.includes('narrate-parse.js')) {
    html = html.replace(
      '  <script src="../../shared/quiz-parse.js"></script>\n',
      '  <script src="../../shared/quiz-parse.js"></script>\n' + NARRATE_PARSE
    );
    changed = true;
  }
  if (!html.includes('lesson-narrator.js')) {
    html = html.replace(
      '  <script src="../../shared/lesson-engine.js"></script>\n',
      '  <script src="../../shared/lesson-engine.js"></script>\n' + NARRATOR_SCRIPT
    );
    changed = true;
  }
  if (!html.includes('id="narrateBtn"')) {
    html = html.replace(
      /(\s*<button class="btn btn-fs" id="fullscreenBtn"[^>]*>⛶<\/button>\n)/,
      '$1' + NARRATE_BTN
    );
    changed = true;
  }
  if (!html.includes('narrateBtn:')) {
    html = html.replace(
      /(\s*quizBtn: document\.getElementById\('quizBtn'\))\n(\s*\}\);)/,
      '$1,\n' + NARRATE_OPT + '$2'
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, html);
    n++;
    console.log('patched', dir.name);
  }
}
console.log(`完成，更新 ${n} 个 index.html`);
