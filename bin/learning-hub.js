#!/usr/bin/env node
import { runValidate } from '../cli/validate.mjs';
import { runSync } from '../cli/sync.mjs';
import { runInit } from '../cli/init.mjs';
import { runServe } from '../cli/serve.mjs';
import { runNarrateBuild } from '../cli/narrate-build.mjs';

const [,, cmd, ...args] = process.argv;

const HELP = `Learning Hub CLI

用法:
  learning-hub validate [path]     校验课程包（默认 library/）
  learning-hub sync              从 manifest 生成 index.json 与各课 index.html
  learning-hub init <id> --title "标题"   脚手架新课
  learning-hub serve [-p 3456]   本地预览
  learning-hub narrate [path...]  预生成旁白 MP3（需 lesson.narrate + Python3）
    可传多个课程目录；无参数则处理 library/ 下全部
    --voice zh-CN-XiaoxiaoNeural  音色
    --force                       覆盖已有音频
    首次运行自动创建 .venv 并安装 edge-tts

示例:
  node bin/learning-hub.js validate
  node bin/learning-hub.js init mysql-index --title "MySQL B+树索引"
  node bin/learning-hub.js sync && node bin/learning-hub.js serve
`;

async function main() {
  switch (cmd) {
    case 'validate':
    case 'v':
      await runValidate(args);
      break;
    case 'sync':
      await runSync();
      break;
    case 'init':
      await runInit(args);
      break;
    case 'serve':
    case 's':
      await runServe(args);
      break;
    case 'narrate':
    case 'narr':
      await runNarrateBuild(args);
      break;
    case 'help':
    case '-h':
    case '--help':
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`未知命令: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
