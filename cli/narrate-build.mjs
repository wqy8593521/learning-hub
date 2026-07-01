import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { synthesizeToFile } from './lib/edge-tts-python.mjs';
import { parseLearnFile } from './lib/load-vml.mjs';
import { loadNarrateParse } from './lib/load-narrate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** 讲解向男声，比新闻腔 Xiaoxiao 更口语 */
const DEFAULT_VOICE = 'zh-CN-YunxiNeural';
/** 略慢于 1.0，听感更接近真人讲课 */
const DEFAULT_RATE = 0.95;
const MP3_BITRATE = 48000; // edge-tts output 48kbit/s mono

function mp3DurationSec(buffer) {
  return buffer.length / (MP3_BITRATE / 8);
}

function speedToRate(speed) {
  const pct = Math.round((speed - 1) * 100);
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct}%`;
}

/** @param {number|string} rate 倍数如 0.95，或 edge-tts 百分比如 -5% */
function normalizeRate(rate) {
  if (typeof rate === 'string' && rate.trim().endsWith('%')) return rate.trim();
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`无效语速: ${rate}（示例: 0.95 或 -5%）`);
  }
  return speedToRate(n);
}

async function synthesizeClip(text, outPath, { voice, rate }) {
  await synthesizeToFile(text, outPath, { voice, rate: normalizeRate(rate) });
  return fs.readFileSync(outPath);
}

export async function buildLessonNarrate(lessonDir, options = {}) {
  const voice = options.voice || DEFAULT_VOICE;
  const rate = options.rate ?? DEFAULT_RATE;
  const force = !!options.force;

  const learnPath = path.join(lessonDir, 'lesson.learn');
  const narratePath = path.join(lessonDir, 'lesson.narrate');
  if (!fs.existsSync(learnPath)) {
    throw new Error(`缺少 ${learnPath}`);
  }

  const lesson = parseLearnFile(learnPath);
  const NarrateDSL = loadNarrateParse();
  let narrateBank = null;
  if (fs.existsSync(narratePath)) {
    narrateBank = NarrateDSL.parse(fs.readFileSync(narratePath, 'utf8'));
  }

  const clips = NarrateDSL.enumerateClips(lesson, narrateBank);
  if (!clips.length) {
    console.log('无可生成的旁白片段');
    return { count: 0 };
  }

  const audioDir = path.join(lessonDir, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  const manifest = {
    version: 1,
    voice,
    rate,
    generatedAt: new Date().toISOString().slice(0, 10),
    clips: {}
  };

  let built = 0;
  for (const clip of clips) {
    const fileName = `s${clip.step}-f${clip.frame}-d${clip.depth}.mp3`;
    const audioRel = `audio/${fileName}`;
    const audioAbs = path.join(lessonDir, audioRel);

    if (!force && fs.existsSync(audioAbs)) {
      const buf = fs.readFileSync(audioAbs);
      const duration = mp3DurationSec(buf);
      manifest.clips[clip.key] = {
        audio: audioRel,
        text: clip.text,
        duration,
        cues: NarrateDSL.buildCues(clip.text, duration)
      };
      built++;
      continue;
    }

    process.stdout.write(`  TTS ${clip.key} … `);
    const buf = await synthesizeClip(clip.text, audioAbs, { voice, rate });
    const duration = mp3DurationSec(buf);
    manifest.clips[clip.key] = {
      audio: audioRel,
      text: clip.text,
      duration,
      cues: NarrateDSL.buildCues(clip.text, duration)
    };
    built++;
    console.log(`${duration.toFixed(1)}s`);
  }

  const manifestPath = path.join(audioDir, 'narrate.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`→ ${manifestPath} (${built} 条)`);
  return { count: built, manifestPath };
}

function lessonDirsFromTarget(target) {
  if (fs.existsSync(path.join(target, 'lesson.learn'))) return [target];
  if (!fs.existsSync(target)) return [];
  return fs.readdirSync(target, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(target, d.name))
    .filter(dir => fs.existsSync(path.join(dir, 'lesson.learn')));
}

export async function runNarrateBuild(args) {
  let voice = DEFAULT_VOICE;
  let rate = DEFAULT_RATE;
  let force = false;
  const explicit = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--voice' && args[i + 1]) voice = args[++i];
    else if (args[i] === '--rate' && args[i + 1]) {
      const raw = args[++i];
      rate = raw.endsWith('%') ? raw : Number(raw);
    }
    else if (args[i] === '--force') force = true;
    else if (!args[i].startsWith('--')) explicit.push(path.resolve(process.cwd(), args[i]));
  }

  const dirs = explicit.length
    ? explicit.filter(dir => {
        if (fs.existsSync(path.join(dir, 'lesson.learn'))) return true;
        console.warn(`跳过（无 lesson.learn）: ${dir}`);
        return false;
      })
    : lessonDirsFromTarget(path.join(ROOT, 'library'));

  if (!dirs.length) {
    console.error('未找到含 lesson.learn 的课程目录');
    process.exit(1);
  }

  for (const dir of dirs) {
    const id = path.basename(dir);
    console.log(`\n[${id}] voice=${voice} rate=${rate}`);
    await buildLessonNarrate(dir, { voice, rate, force });
  }
}
