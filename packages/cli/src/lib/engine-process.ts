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
    let cancelled: 'SIGINT' | 'SIGTERM' | undefined;
    let finished = false;
    let termination: Promise<string | undefined> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      process.removeListener('SIGINT', onInterrupt);
      process.removeListener('SIGTERM', onTerminate);
    };
    const finish = (result: EngineProcessResult) => {
      if (finished || cancelled) return;
      finished = true;
      cleanup();
      resolve(result);
    };
    const terminateTree = () => {
      termination ??= new Promise<string | undefined>(done => {
        if (!child.pid) { done('Worker did not start.'); return; }
        if (process.platform === 'win32') {
          execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }, (error) => {
            if (error) child.kill('SIGKILL');
            done(error ? `Process-tree termination failed: ${error.message}` : undefined);
          });
        } else {
          try { process.kill(-child.pid, 'SIGKILL'); done(undefined); }
          catch (error) {
            done((error as NodeJS.ErrnoException).code === 'ESRCH' ? undefined : error instanceof Error ? error.message : String(error));
          }
        }
      });
      return termination;
    };
    const cancel = (signal: 'SIGINT' | 'SIGTERM') => {
      if (finished || cancelled) return;
      cancelled = signal;
      clearTimeout(timer);
      void terminateTree().then(error => {
        cleanup();
        if (error) process.stderr.write(`Verification cancelled; ${error}\n`);
        // Restore native signal termination after the scoped tree kill completes.
        // Never resolve to verify: even a concurrent exit 0 is not verification.
        process.kill(process.pid, signal);
      });
    };
    const onInterrupt = () => cancel('SIGINT');
    const onTerminate = () => cancel('SIGTERM');
    process.on('SIGINT', onInterrupt);
    process.on('SIGTERM', onTerminate);
    const timer = setTimeout(() => {
      budgetExceeded = true;
      void terminateTree().then(error => {
        if (error) finish({ exitCode: null, budgetExceeded, error });
      });
    }, input.budgetMs);
    child.once('error', error => finish({ exitCode: null, budgetExceeded, error: error.message }));
    child.once('close', async code => {
      const error = await termination;
      finish({ exitCode: code, budgetExceeded, error });
    });
  });
}
