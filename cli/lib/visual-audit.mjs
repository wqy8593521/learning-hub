/**
 * 全库可视化审查 — 渲染 SVG 检查 slot 泄漏、帧密度、重叠
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadVML } from './load-vml.mjs';
import { lintVisualLesson } from './vml-visual-lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(__dirname, '../../library');

const PRIMARY = new Set([
  'box', 'flow', 'compare', 'buckets', 'chain', 'tree', 'timeline', 'state',
  'stack', 'table', 'queue', 'meter', 'codeblock', 'threads', 'math', 'items'
]);

const SLOT_RE = /slot=(?:bottom|top|right|center)/;

export function auditLesson(id) {
  const learnPath = path.join(LIB, id, 'lesson.learn');
  if (!fs.existsSync(learnPath)) return null;
  const source = fs.readFileSync(learnPath, 'utf8');
  const VML = loadVML();
  const lesson = VML.parse(source);
  const issues = [];

  // lint
  for (const i of lintVisualLesson(lesson, { strict: true })) {
    issues.push({ level: i.level, id: i.id, msg: i.msg });
  }

  // SVG slot leak
  const scenes = VML.lessonToScenes(lesson);
  scenes.forEach((sc, si) => {
    const stepName = lesson.steps[si].short;
    for (let f = 0; f < sc.frames; f++) {
      let primary = 0;
      for (const fr of lesson.steps[si]._compiled || []) {
        const m = fr.min === -1 || (fr.plus ? f >= fr.min : f === fr.min);
        if (!m || fr.layer > 0) continue;
        for (const c of fr.cmds) if (PRIMARY.has(c.t)) primary++;
      }
      if (primary > 3) {
        issues.push({ level: 'warn', id: 'density', msg: `step「${stepName}」帧${f} 主图元${primary}个` });
      }
      const svg = sc.render(0, f);
      if (SLOT_RE.test(svg)) {
        issues.push({ level: 'error', id: 'slot-leak', msg: `step「${stepName}」帧${f} SVG含 slot=` });
      }
    }
  });

  // parsed state/flow leak
  for (const step of lesson.steps) {
    for (const fr of step._compiled || []) {
      for (const c of fr.cmds) {
        if (c.t === 'state' && c.states?.some(s => SLOT_RE.test(s))) {
          issues.push({ level: 'error', id: 'parse-leak', msg: `step「${step.short}」state 含 slot=` });
        }
        if (c.t === 'flow' && c.steps?.some(s => SLOT_RE.test(s))) {
          issues.push({ level: 'error', id: 'parse-leak', msg: `step「${step.short}」flow 含 slot=` });
        }
        if (c.t === 'stack' && c.frames?.some(s => SLOT_RE.test(s))) {
          issues.push({ level: 'error', id: 'parse-leak', msg: `step「${step.short}」stack 含 slot=` });
        }
      }
    }
  }

  return { id, issues, issueCount: issues.length };
}

export function auditLibrary() {
  const ids = fs.readdirSync(LIB).filter(d => fs.existsSync(path.join(LIB, d, 'lesson.learn')));
  return ids.map(auditLesson).filter(Boolean).sort((a, b) => b.issueCount - a.issueCount);
}
