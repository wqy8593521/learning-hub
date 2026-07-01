import fs from 'fs';
import path from 'path';

const REQUIRED = ['id', 'title', 'tags', 'vml', 'createdAt'];

export function parseManifestYaml(source) {
  const result = {};
  const lines = source.split('\n');
  let i = 0;
  let currentKey = null;
  let listKey = null;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\r$/, '');
    i++;

    if (!line.trim() || line.trim().startsWith('#')) continue;

    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && listKey) {
      if (!Array.isArray(result[listKey])) result[listKey] = [];
      result[listKey].push(unquote(listMatch[1].trim()));
      continue;
    }

    listKey = null;
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1];
    const val = kv[2].trim();
    currentKey = key;

    if (val === '') {
      listKey = key;
      result[key] = [];
      continue;
    }

    if (val === '[]') {
      result[key] = [];
      continue;
    }

    if (val === 'true') result[key] = true;
    else if (val === 'false') result[key] = false;
    else if (/^\d+$/.test(val)) result[key] = +val;
    else result[key] = unquote(val);
  }

  return result;
}

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function readManifest(dir) {
  const file = path.join(dir, 'manifest.yaml');
  if (!fs.existsSync(file)) return null;
  return parseManifestYaml(fs.readFileSync(file, 'utf8'));
}

export function validateManifestShape(manifest, dirName) {
  const errors = [];
  for (const key of REQUIRED) {
    if (manifest[key] == null || manifest[key] === '') errors.push(`manifest 缺少必填字段: ${key}`);
  }
  if (manifest.id && manifest.id !== dirName) {
    errors.push(`manifest.id (${manifest.id}) 与目录名 (${dirName}) 不一致`);
  }
  if (manifest.tags && !Array.isArray(manifest.tags)) errors.push('manifest.tags 必须是列表');
  if (manifest.prerequisites && !Array.isArray(manifest.prerequisites)) {
    errors.push('manifest.prerequisites 必须是列表');
  }
  if (manifest.quiz != null && typeof manifest.quiz !== 'boolean') {
    errors.push('manifest.quiz 必须是 true/false');
  }
  return errors;
}

export function findLessonDirs(libraryRoot) {
  if (!fs.existsSync(libraryRoot)) return [];
  return fs.readdirSync(libraryRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'node_modules')
    .map(d => path.join(libraryRoot, d.name))
    .filter(dir => fs.existsSync(path.join(dir, 'manifest.yaml')));
}
