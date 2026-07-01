import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readManifest, validateManifestShape } from './lib/manifest.mjs';
import { parseLearnFile } from './lib/load-vml.mjs';
import { parseQuizFile } from './lib/load-quiz.mjs';
import { parseNarrateFile } from './lib/load-narrate.mjs';
import { renderLessonHtml, TEMPLATE_PATH } from './lib/lesson-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function validateLessonDir(dir) {
  const errors = [];
  const warnings = [];
  const dirName = path.basename(dir);
  const manifest = readManifest(dir);

  if (!manifest) {
    return { dir, ok: false, errors: ['缺少 manifest.yaml'] };
  }

  errors.push(...validateManifestShape(manifest, dirName));

  if (!manifest.subject) warnings.push('建议填写 manifest.subject（科目）');
  if (!manifest.chapter) warnings.push('建议填写 manifest.chapter（章节）');

  const learnPath = path.join(dir, 'lesson.learn');
  const quizPath = path.join(dir, 'lesson.quiz');
  const narratePath = path.join(dir, 'lesson.narrate');
  const hasQuizFile = fs.existsSync(quizPath);
  const hasNarrateFile = fs.existsSync(narratePath);
  const hasLearn = fs.existsSync(learnPath);

  if (!hasLearn) errors.push('缺少 lesson.learn');
  if (!fs.existsSync(TEMPLATE_PATH)) errors.push('缺少 templates/lesson/index.html 模板');

  if (manifest.quiz === true && !hasQuizFile) {
    errors.push('manifest.quiz=true 但缺少 lesson.quiz');
  }
  if (manifest.quiz === false && hasQuizFile) {
    warnings.push('存在 lesson.quiz 但 manifest.quiz=false');
  }

  let lesson = null;
  if (hasLearn) {
    try {
      lesson = parseLearnFile(learnPath);
      if (!lesson.title) errors.push('lesson.learn 未解析出 title');
      if (!lesson.steps?.length) errors.push('lesson.learn 至少需要一个 step');
      if (lesson.steps?.length > 5) warnings.push(`step 数 ${lesson.steps.length} 超过建议上限 5`);
      for (const step of lesson.steps || []) {
        if (step.frames > 4) warnings.push(`step「${step.short}」frames=${step.frames} 超过建议上限 4`);
      }
    } catch (e) {
      errors.push(`lesson.learn 解析失败: ${e.message}`);
    }
  }

  if (manifest.steps != null && lesson && manifest.steps !== lesson.steps.length) {
    errors.push(`manifest.steps (${manifest.steps}) 与 lesson.learn 实际 (${lesson.steps.length}) 不一致`);
  }

  let bank = null;
  if (hasQuizFile) {
    try {
      bank = parseQuizFile(quizPath);
      if (!Object.keys(bank.pool).length) errors.push('lesson.quiz pool 为空');
      for (const qList of Object.values(bank.pool)) {
        for (const q of qList) {
          if (!q.ask) errors.push(`题目「${q.concept}」缺少 ask`);
          if (q.style === 'pick_one' && q.opts.length < 2) {
            errors.push(`题目「${q.concept}」选项不足`);
          }
          if (q.style === 'pick_one' && (q.answer < 0 || q.answer >= q.opts.length)) {
            errors.push(`题目「${q.concept}」answer 越界`);
          }
        }
      }
      if (lesson) {
        for (const tr of bank.triggers) {
          if (tr.type === 'after_step' && tr.step >= lesson.steps.length) {
            errors.push(`trigger after_step ${tr.step} 越界（共 ${lesson.steps.length} 步）`);
          }
          if (tr.type === 'after_step') {
            for (const c of tr.concepts) {
              if (!bank.pool[c]) errors.push(`trigger 引用未知 concept: ${c}`);
            }
          }
        }
      }
    } catch (e) {
      errors.push(`lesson.quiz 解析失败: ${e.message}`);
    }
  }

  if (hasNarrateFile) {
    try {
      const narrate = parseNarrateFile(narratePath);
      if (!narrate.steps?.length) warnings.push('lesson.narrate 无 step 旁白');
      if (lesson) {
        const learnShorts = new Set(lesson.steps.map(s => s.short));
        for (const ns of narrate.steps) {
          if (!learnShorts.has(ns.short)) {
            warnings.push(`lesson.narrate step「${ns.short}」在 lesson.learn 中不存在`);
          }
        }
        if (narrate.steps.length > lesson.steps.length) {
          warnings.push('lesson.narrate step 数多于 lesson.learn');
        }
      }
      if (hasNarrateFile && fs.existsSync(TEMPLATE_PATH)) {
        const html = renderLessonHtml(manifest);
        if (!html.includes('narrate-parse.js')) {
          warnings.push('有 lesson.narrate 但播放器模板未引用 narrate-parse.js');
        }
      }
    } catch (e) {
      errors.push(`lesson.narrate 解析失败: ${e.message}`);
    }
  }

  const audioManifestPath = path.join(dir, 'audio', 'narrate.json');
  if (fs.existsSync(audioManifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(audioManifestPath, 'utf8'));
      if (!manifest.clips || !Object.keys(manifest.clips).length) {
        warnings.push('audio/narrate.json 无 clips');
      }
    } catch (e) {
      errors.push(`audio/narrate.json 解析失败: ${e.message}`);
    }
  }

  if (fs.existsSync(TEMPLATE_PATH)) {
    let html;
    try {
      html = renderLessonHtml(manifest);
    } catch (e) {
      errors.push(`播放器模板渲染失败: ${e.message}`);
      html = '';
    }
    if (html) {
      if (!html.includes('lesson-player.js')) errors.push('播放器模板未引用 lesson-player.js');
      if (!html.includes('vml.js')) errors.push('播放器模板未引用 vml.js');
      if (manifest.quiz && !html.includes('quizOverlay') && !html.includes('quizLayer')) {
        warnings.push('manifest.quiz=true 但播放器模板无测验层 (quizLayer/quizOverlay)');
      }
      if (!html.includes('lesson-engine.js')) {
        warnings.push('播放器模板未引用 lesson-engine.js（建议升级模板）');
      }
      const idMatch = html.match(/lessonId:\s*['"]([^'"]+)['"]/);
      if (idMatch && idMatch[1] !== manifest.id) {
        errors.push(`播放器模板 lessonId (${idMatch[1]}) 与 manifest.id 不一致`);
      }
      if (manifest.quiz && !html.includes('quiz-engine.js')) {
        errors.push('manifest.quiz=true 但播放器模板未引用 quiz-engine.js');
      }
    }
  }

  return {
    dir,
    id: manifest.id,
    ok: errors.length === 0,
    errors,
    warnings,
    steps: lesson?.steps?.length ?? null
  };
}

export async function runValidate(args) {
  const target = args[0] ? path.resolve(process.cwd(), args[0]) : path.join(ROOT, 'library');
  const dirs = fs.existsSync(path.join(target, 'manifest.yaml'))
    ? [target]
    : fs.readdirSync(target, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => path.join(target, d.name))
        .filter(dir => fs.existsSync(path.join(dir, 'manifest.yaml')));

  if (!dirs.length) {
    console.error('未找到含 manifest.yaml 的课程目录');
    process.exit(1);
  }

  let failed = 0;
  for (const dir of dirs) {
    const result = validateLessonDir(dir);
    const label = result.id || path.basename(dir);
    if (result.ok) {
      console.log(`✓ ${label}${result.warnings.length ? ` (${result.warnings.length} 警告)` : ''}`);
      result.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    } else {
      failed++;
      console.error(`✗ ${label}`);
      result.errors.forEach(e => console.error(`  · ${e}`));
      result.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    }
  }

  if (failed) process.exit(1);
  console.log(`\n${dirs.length} 门课程校验通过`);
}
