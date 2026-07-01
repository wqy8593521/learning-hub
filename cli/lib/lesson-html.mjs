import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export const TEMPLATE_PATH = path.join(ROOT, 'templates/lesson/index.html');

export function renderLessonHtml(manifest) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error('缺少 templates/lesson/index.html');
  }
  const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return tpl
    .replace(/\{\{id\}\}/g, manifest.id)
    .replace(/\{\{title\}\}/g, manifest.title);
}

export function writeLessonHtml(dir, manifest) {
  const html = renderLessonHtml(manifest);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return html;
}
