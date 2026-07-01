import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

let cached = null;

export function loadNarrateParse() {
  if (cached) return cached;
  const code = fs.readFileSync(path.join(ROOT, 'shared/narrate-parse.js'), 'utf8');
  const ctx = { globalThis: {} };
  vm.runInNewContext(code, ctx);
  cached = ctx.globalThis.NarrateDSL;
  if (!cached?.parse) throw new Error('无法加载 NarrateDSL.parse');
  return cached;
}

export function parseNarrateFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return loadNarrateParse().parse(source);
}
