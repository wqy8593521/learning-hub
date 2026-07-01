import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'templates/lesson');

function parseArgs(args) {
  const id = args[0];
  let title = id || '新课程';
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--title' && args[i + 1]) {
      title = args[++i];
    }
  }
  return { id, title };
}

function replacePlaceholders(content, vars) {
  return content
    .replace(/\{\{id\}\}/g, vars.id)
    .replace(/\{\{title\}\}/g, vars.title)
    .replace(/\{\{createdAt\}\}/g, vars.createdAt);
}

export async function runInit(args) {
  const { id, title } = parseArgs(args);
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    console.error('用法: learning-hub init <id> --title "课程标题"');
    console.error('  id 仅允许小写字母、数字、连字符');
    process.exit(1);
  }

  const dest = path.join(ROOT, 'library', id);
  if (fs.existsSync(dest)) {
    console.error(`目录已存在: library/${id}`);
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATE)) {
    console.error('缺少 templates/lesson/ 模板目录');
    process.exit(1);
  }

  const createdAt = new Date().toISOString().slice(0, 10);
  const vars = { id, title, createdAt };

  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(TEMPLATE)) {
    if (name === 'index.html') continue; // sync 时从模板生成
    const src = path.join(TEMPLATE, name);
    if (!fs.statSync(src).isFile()) continue;
    const outName = name === 'lesson.quiz.optional' ? 'lesson.quiz' : name;
    const content = replacePlaceholders(fs.readFileSync(src, 'utf8'), vars);
    fs.writeFileSync(path.join(dest, outName), content);
  }

  console.log(`已创建 library/${id}/`);
  console.log(`  1. 编辑 lesson.learn / lesson.narrate（或让 Agent 生成）`);
  console.log(`  2. node bin/learning-hub.js validate library/${id}`);
  console.log(`  3. node bin/learning-hub.js sync  # 生成 index.html + index.json`);
}
