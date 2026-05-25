import type { RunStrykerOptions } from '../types';
import { readStrykerJsonReport } from '../stryker/report-parser';
import { runStryker } from '../stryker/runner';
import { normalizeMutationSummary } from '../report/normalize';
import type { MutationRunnerPlugin, NormalizedMutationReport } from './types';

export function createStrykerRunnerPlugin(): MutationRunnerPlugin<RunStrykerOptions> {
  return {
    id: 'stryker-js',
    displayName: 'StrykerJS',
    languages: ['javascript', 'typescript'],
    detect(context) {
      const deps = {
        ...context.packageJson?.dependencies,
        ...context.packageJson?.devDependencies
      };
      const hasStryker = Boolean(deps['@stryker-mutator/core']);

      return {
        supported: hasStryker,
        confidence: hasStryker ? 'high' : 'low',
        reason: hasStryker ? 'StrykerJS dependency detected.' : 'StrykerJS dependency was not detected.',
        limitations: []
      };
    },
    async run(plan) {
      return runStryker(plan);
    },
    parseReport(input): NormalizedMutationReport {
      if (typeof input !== 'string') {
        throw new Error('Stryker runner parseReport expects a mutation JSON file path.');
      }

      const summary = readStrykerJsonReport(input);
      return normalizeMutationSummary({
        summary,
        runner: {
          id: 'stryker-js',
          name: summary.stryker?.frameworkName ?? 'StrykerJS',
          engineVersion: summary.stryker?.frameworkVersion,
          language: 'typescript'
        },
        scope: {
          mutatedFiles: [...new Set(summary.allMutants.map((mutant) => mutant.filePath))].sort()
        },
        engineMetadata: {
          stryker: summary.stryker
        }
      });
    }
  };
}
