import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

writeFileSync('worker.pid', String(process.pid));
if (process.argv[2] !== 'complete') {
  spawn(process.execPath, [fileURLToPath(new URL('./leaf.mjs', import.meta.url))], { stdio: 'ignore', windowsHide: true });
  setInterval(() => {}, 1000);
}
