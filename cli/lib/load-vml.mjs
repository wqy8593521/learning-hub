import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { lintLessonFull } from './vml-visual-lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

let cached = null;

export function loadVML() {
  if (cached) return cached.VML;
  const ctx = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'shared/vml.js'), 'utf8'), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'shared/vml-strict.js'), 'utf8'), ctx);
  cached = { VML: ctx.globalThis.VML, VMLStrict: ctx.globalThis.VMLStrict };
  if (!cached.VML?.parse) throw new Error('无法加载 VML.parse');
  if (!cached.VMLStrict?.lint) throw new Error('无法加载 VMLStrict');
  return cached.VML;
}

export function loadVMLStrict() {
  loadVML();
  return cached.VMLStrict;
}

export function parseLearnFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return loadVML().parse(source);
}

export function parseLearnSource(source) {
  return loadVML().parse(source);
}

export function lintLearnLesson(lesson, source = '', opts = {}) {
  const issues = [];
  const isStrict = opts.strict || lesson?.mode === 'strict';
  if (isStrict) issues.push(...loadVMLStrict().lint(lesson));
  issues.push(...lintLessonFull(lesson, source, { strict: isStrict }));
  return issues;
}
