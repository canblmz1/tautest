import path from 'node:path';
import type { PackageJson, ProjectInfo, TestRunner, TestRunnerDetection } from '../types';

export function detectTestRunner(project: Pick<ProjectInfo, 'packageJson' | 'vitestConfigFiles' | 'jestConfigFiles'>): TestRunnerDetection {
  return detectTestRunnerFromSignals({
    packageJson: project.packageJson,
    vitestConfigFiles: project.vitestConfigFiles,
    jestConfigFiles: project.jestConfigFiles
  });
}

export function detectTestRunnerFromSignals(input: {
  packageJson?: PackageJson | null;
  vitestConfigFiles?: string[];
  jestConfigFiles?: string[];
}): TestRunnerDetection {
  const candidates: TestRunner[] = [];
  const deps = allDependencies(input.packageJson);
  const hasVitest = deps.has('vitest') || Boolean(input.vitestConfigFiles?.length);
  const hasJest = deps.has('jest') || Boolean(input.jestConfigFiles?.length);

  if (hasVitest) {
    candidates.push('vitest');
  }

  if (hasJest) {
    candidates.push('jest');
  }

  if (hasVitest) {
    return {
      runner: 'vitest',
      candidates,
      configFile: input.vitestConfigFiles?.[0],
      reason: hasJest ? 'Both Vitest and Jest detected; defaulting to Vitest.' : 'Vitest detected.'
    };
  }

  if (hasJest) {
    return {
      runner: 'jest',
      candidates,
      configFile: input.jestConfigFiles?.[0],
      reason: 'Jest detected.'
    };
  }

  return {
    runner: null,
    candidates,
    reason: 'No Vitest or Jest dependency/configuration was detected.'
  };
}

export function findRunnerConfigFiles(rootDir: string, fileNames: string[], exists: (filePath: string) => boolean): string[] {
  return fileNames.map((fileName) => path.join(rootDir, fileName)).filter(exists);
}

function allDependencies(packageJson?: PackageJson | null): Set<string> {
  return new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
    ...Object.keys(packageJson?.peerDependencies ?? {})
  ]);
}

