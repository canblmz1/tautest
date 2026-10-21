import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

let suite: string;
let helper: string;
const fixtures = fileURLToPath(new URL('./fixtures/engine-process/', import.meta.url));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean, ms = 8000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check() && Date.now() < deadline) await delay(20);
  expect(check()).toBe(true);
}
function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    // An orphan may await PID 1 reaping in a container; a zombie cannot execute.
    if (process.platform === 'linux' && /\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'))) return false;
    return true;
  } catch { return false; }
}
function stop(pid: number, group = false): void {
  try {
    if (process.platform === 'win32') execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 5000 });
    else process.kill(group ? -pid : pid, 'SIGKILL');
  } catch { /* Already exited. Only fixture-owned pids/groups are targeted. */ }
}
beforeAll(() => {
  suite = mkdtempSync(path.join(tmpdir(), 'tautest-engine-process-'));
  helper = path.join(suite, 'engine-process.mjs');
  const source = readFileSync(new URL('../src/lib/engine-process.ts', import.meta.url), 'utf8');
  writeFileSync(helper, transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText);
});
afterAll(() => rmSync(suite, { recursive: true, force: true }));

async function fixture(mode: string, test: (input: { root: string; parent: ChildProcess; closed: () => boolean; signal: () => NodeJS.Signals | null; code: () => number | null }) => Promise<void>, budgetMs = 30000) {
  const root = mkdtempSync(path.join(suite, 'run-'));
  const parent = spawn(process.execPath, [path.join(fixtures, 'parent.mjs'), helper, root, mode, String(budgetMs)], {
    detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
  });
  let closed = false;
  let signal: NodeJS.Signals | null = null;
  let code: number | null = null;
  let stderr = '';
  parent.stderr?.on('data', chunk => { stderr += chunk; });
  parent.once('close', (value, reason) => { closed = true; code = value; signal = reason; });
  try {
    await test({ root, parent, closed: () => closed, signal: () => signal, code: () => code });
    expect(stderr).toBe('');
  } finally {
    // Even a RED assertion or readiness timeout cannot leave its processes behind.
    for (const name of ['worker.pid', 'leaf.pid']) {
      const file = path.join(root, name);
      if (existsSync(file)) stop(Number(readFileSync(file, 'utf8')), name === 'worker.pid' && process.platform !== 'win32');
    }
    if (parent.pid) stop(parent.pid, process.platform !== 'win32');
    await until(() => closed);
  }
}

describe('engine process lifecycle', () => {
  it.each(['SIGINT', 'SIGTERM'] as const)('stops a ready worker and grandchild on %s before preserving cancellation', async signal => {
    await fixture('tree', async run => {
      const leaf = path.join(run.root, 'leaf.ready');
      await until(() => existsSync(leaf));
      const workerPid = Number(readFileSync(path.join(run.root, 'worker.pid'), 'utf8'));
      const leafPid = Number(readFileSync(path.join(run.root, 'leaf.pid'), 'utf8'));
      expect(running(workerPid)).toBe(true);
      expect(running(leafPid)).toBe(true);
      // Windows process.kill bypasses JS handlers. Exercise real tree cleanup via
      // IPC-dispatched handlers there; POSIX sends an actual OS signal to parent.
      if (process.platform === 'win32') run.parent.send(signal);
      else run.parent.kill(signal);
      await until(run.closed);
      if (process.platform !== 'win32') expect(run.signal()).toBe(signal);
      else expect(run.code()).not.toBe(0);
      await until(() => !running(workerPid) && !running(leafPid), 2000);
      expect(existsSync(path.join(run.root, 'result.json'))).toBe(false);
    });
  }, 25000);

  it('preserves normal results and removes signal listeners and the budget timer', async () => {
    await fixture('complete', async run => {
      await until(run.closed);
      expect(run.code()).toBe(0);
      expect(JSON.parse(readFileSync(path.join(run.root, 'result.json'), 'utf8'))).toEqual({
        result: { exitCode: 0, budgetExceeded: false }, listeners: [0, 0]
      });
    });
  }, 15000);

  it('absorbs repeated cancellation while closing the same owned tree', async () => {
    await fixture('tree', async run => {
      await until(() => existsSync(path.join(run.root, 'leaf.ready')));
      const pids = ['worker.pid', 'leaf.pid'].map(name => Number(readFileSync(path.join(run.root, name), 'utf8')));
      // Synchronous dispatch covers re-entry even when tree termination is fast.
      run.parent.send(['SIGINT', 'SIGTERM', 'SIGINT']);
      await until(run.closed);
      if (process.platform !== 'win32') expect(run.signal()).toBe('SIGINT');
      else expect(run.code()).not.toBe(0);
      await until(() => pids.every(pid => !running(pid)), 2000);
      expect(existsSync(path.join(run.root, 'result.json'))).toBe(false);
    });
  }, 25000);

  it('keeps budget exhaustion separate and stops both live processes', async () => {
    await fixture('tree', async run => {
      await until(() => existsSync(path.join(run.root, 'leaf.ready')));
      const pids = ['worker.pid', 'leaf.pid'].map(name => Number(readFileSync(path.join(run.root, name), 'utf8')));
      expect(pids.every(running)).toBe(true);
      await until(run.closed);
      expect(run.code()).toBe(0);
      expect(JSON.parse(readFileSync(path.join(run.root, 'result.json'), 'utf8'))).toEqual({
        result: { exitCode: process.platform === 'win32' ? 1 : null, budgetExceeded: true }, listeners: [0, 0]
      });
      await until(() => pids.every(pid => !running(pid)), 2000);
    }, 3000);
  }, 20000);

  it('cleans up on spawn errors without claiming timeout or success', async () => {
    await fixture('error', async run => {
      await until(run.closed);
      const outcome = JSON.parse(readFileSync(path.join(run.root, 'result.json'), 'utf8'));
      expect(outcome).toMatchObject({ result: { exitCode: null, budgetExceeded: false }, listeners: [0, 0] });
      expect(outcome.result.error).toContain('ENOENT');
    });
  }, 15000);
});
