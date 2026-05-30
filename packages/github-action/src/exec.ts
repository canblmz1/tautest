import path from 'node:path';
import { existsSync } from 'node:fs';
import * as exec from '@actions/exec';

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function execCommand(command: string, args: string[], cwd: string, silent = true): Promise<ExecResult> {
  let stdout = '';
  let stderr = '';
  const exitCode = await exec.exec(command, args, {
    cwd,
    silent,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data) => {
        stdout += data.toString();
      },
      stderr: (data) => {
        stderr += data.toString();
      }
    }
  });

  return { exitCode, stdout, stderr };
}

export function findUp(startDir: string, relativePath: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, relativePath);

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
