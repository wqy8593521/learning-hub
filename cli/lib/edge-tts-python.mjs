import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function venvEdgeTtsBin() {
  return path.join(ROOT, '.venv', 'bin', 'edge-tts');
}

function venvPipBin() {
  return path.join(ROOT, '.venv', 'bin', 'pip');
}

/** Ensure project-local Python venv with edge-tts CLI. */
export async function ensureEdgeTts() {
  const bin = venvEdgeTtsBin();
  if (fs.existsSync(bin)) return bin;

  process.stdout.write('正在创建 .venv 并安装 edge-tts … ');
  await execFileAsync('python3', ['-m', 'venv', path.join(ROOT, '.venv')]);
  await execFileAsync(venvPipBin(), ['install', '-q', 'edge-tts']);
  console.log('完成');
  return bin;
}

/**
 * Synthesize speech to an MP3 file via Python edge-tts CLI.
 * @param {string} text
 * @param {string} outPath
 * @param {{ voice: string, rate: string }} options
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function synthesizeToFile(text, outPath, { voice, rate, retries = 4 } = {}) {
  const bin = await ensureEdgeTts();
  const tmpText = path.join(
    os.tmpdir(),
    `lh-tts-${process.pid}-${Date.now()}.txt`
  );
  fs.writeFileSync(tmpText, text, 'utf8');
  try {
    const args = ['--file', tmpText, '--write-media', outPath, '--voice', voice];
    if (rate) args.push(`--rate=${rate}`);
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await execFileAsync(bin, args, { timeout: 120_000 });
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < retries) await sleep(1500 * attempt);
      }
    }
    throw lastErr;
  } finally {
    try {
      fs.unlinkSync(tmpText);
    } catch {
      /* ignore */
    }
  }
}
