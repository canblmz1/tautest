import { spawn, execFile } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';

export interface EngineProcessResult { exitCode: number | null; budgetExceeded: boolean; error?: string }
export function runEngineProcess(input: { root: string; request: string; worker: string; log: string; budgetMs: number }): Promise<EngineProcessResult> {
  return new Promise(resolve => {
    const log = openSync(input.log, 'w');
    const child = spawn(process.execPath, [input.worker, input.request], {
      cwd: input.root, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', log, log]
    });
    closeSync(log);
    let budgetExceeded = false;
    let termination: Promise<string | undefined> | undefined;
    const timer = setTimeout(() => {
      budgetExceeded = true;
      termination = new Promise(done => {
        if (!child.pid) { done('Worker did not start.'); return; }
        if (process.platform === 'win32') {
          execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }, (error) => {
            if (error) {
              child.kill('SIGKILL');
              resolve({ exitCode: null, budgetExceeded: true, error: `Process-tree termination failed: ${error.message}` });
            }
            done(error?.message);
          });
        } else {
          try { process.kill(-child.pid, 'SIGKILL'); done(undefined); }
          catch (error) { done(error instanceof Error ? error.message : String(error)); }
        }
      });
    }, input.budgetMs);
    child.once('error', error => { clearTimeout(timer); resolve({ exitCode: null, budgetExceeded, error: error.message }); });
    child.once('close', async code => {
      clearTimeout(timer);
      resolve({ exitCode: code, budgetExceeded, error: await termination });
    });
  });
}
