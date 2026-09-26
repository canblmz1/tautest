import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function gitProject(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'tautest-cli-git-'));

  for (const [relativePath, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    writeFileSync(path.join(root, relativePath), content);
  }

  for (const args of [['init', '-q'], ['config', 'user.email', 'fixture@example.invalid'], ['config', 'user.name', 'fixture'], ['add', '-A'], ['commit', '-qm', 'base']]) {
    execFileSync('git', args, { cwd: root });
  }

  return root;
}
