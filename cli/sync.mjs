import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findLessonDirs, readManifest } from './lib/manifest.mjs';
import { parseLearnFile } from './lib/load-vml.mjs';
import { buildCatalogTree } from './lib/catalog-tree.mjs';
import { writeLessonHtml } from './lib/lesson-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LIBRARY = path.join(ROOT, 'library');

export async function runSync() {
  const dirs = findLessonDirs(LIBRARY).sort();
  const lessons = [];
  let htmlCount = 0;

  for (const dir of dirs) {
    const manifest = readManifest(dir);
    if (!manifest) continue;

    const id = manifest.id;
    let steps = manifest.steps;
    const learnPath = path.join(dir, 'lesson.learn');
    if (fs.existsSync(learnPath)) {
      try {
        const lesson = parseLearnFile(learnPath);
        steps = lesson.steps.length;
      } catch {
        steps = manifest.steps ?? 0;
      }
    }

    writeLessonHtml(dir, manifest);
    htmlCount++;

    const entry = {
      id,
      title: manifest.title,
      subject: manifest.subject || '未分类',
      chapter: manifest.chapter || '综合',
      order: manifest.order ?? 999,
      tags: manifest.tags || [],
      prerequisites: manifest.prerequisites || [],
      dsl: `library/${id}/lesson.learn`,
      path: `library/${id}/index.html`,
      createdAt: manifest.createdAt,
      steps: steps ?? 0,
      depths: 3
    };

    if (manifest.subjectOrder != null) entry.subjectOrder = manifest.subjectOrder;
    if (manifest.chapterOrder != null) entry.chapterOrder = manifest.chapterOrder;

    if (manifest.quiz) {
      entry.quiz = `library/${id}/lesson.quiz`;
    }
    if (fs.existsSync(path.join(dir, 'lesson.narrate'))) {
      entry.narrate = `library/${id}/lesson.narrate`;
    }
    if (fs.existsSync(path.join(dir, 'audio', 'narrate.json'))) {
      entry.narrateAudio = `library/${id}/audio/narrate.json`;
    }

    lessons.push(entry);
  }

  const catalog = {
    version: 3,
    format: 'vml',
    tree: buildCatalogTree(lessons),
    lessons
  };

  const out = path.join(LIBRARY, 'index.json');
  fs.writeFileSync(out, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`已同步 ${lessons.length} 门课程 → library/index.json`);
  console.log(`已生成 ${htmlCount} 个 index.html（本地预览 / Pages 部署用，不提交 git）`);
}
