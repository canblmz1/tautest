import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [helper, root, mode, budget] = process.argv.slice(2);
const { runEngineProcess } = await import(pathToFileURL(helper).href);
// Windows does not support delivering SIGINT/SIGTERM with process.kill.
process.on('message', signals => {
  for (const signal of Array.isArray(signals) ? signals : [signals]) process.emit(signal);
});
const before = ['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal));
const result = await runEngineProcess({ root: mode === 'error' ? path.join(root, 'missing') : root, worker: fileURLToPath(new URL('./worker.mjs', import.meta.url)),
  request: mode, log: path.join(root, 'worker.log'), budgetMs: Number(budget) });
writeFileSync(path.join(root, 'result.json'), JSON.stringify({ result,
  listeners: ['SIGINT', 'SIGTERM'].map((signal, i) => process.listenerCount(signal) - before[i]) }));
process.disconnect();
