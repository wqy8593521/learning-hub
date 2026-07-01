import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export async function runServe(args) {
  let port = 3456;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-p' || args[i] === '--port') && args[i + 1]) {
      port = +args[++i];
    }
  }

  console.log(`Learning Hub → http://localhost:${port}`);
  console.log('按 Ctrl+C 停止');

  const child = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  child.on('error', () => {
    console.error('无法启动 python3 http.server，请安装 Python 3 或手动运行:');
    console.error(`  cd ${ROOT} && python3 -m http.server ${port}`);
    process.exit(1);
  });

  child.on('exit', code => process.exit(code ?? 0));
}
