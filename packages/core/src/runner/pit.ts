import { mapEngineStatus } from '../report/normalize';
import type { MutationRunnerPlugin, NormalizedMutationReport, NormalizedMutant } from './types';

export function createPitAlphaRunnerPlugin(): MutationRunnerPlugin<never, never> {
  return {
    id: 'pit-alpha',
    displayName: 'PIT alpha',
    languages: ['java'],
    detect(context) {
      const files = context.files ?? [];
      const hasJavaProject = files.some((file) => ['pom.xml', 'build.gradle', 'build.gradle.kts'].includes(file));

      return {
        supported: hasJavaProject,
        confidence: hasJavaProject ? 'medium' : 'low',
        reason: hasJavaProject ? 'Java build file detected.' : 'No Maven or Gradle build file detected.',
        limitations: javaAlphaLimitations()
      };
    },
    parseReport(input): NormalizedMutationReport {
      if (typeof input !== 'string') {
        throw new Error('PIT alpha parser expects XML text.');
      }

      return parsePitXmlReport(input);
    },
    explainLimitations: javaAlphaLimitations
  };
}

export function parsePitXmlReport(xml: string): NormalizedMutationReport {
  const mutants = [...xml.matchAll(/<mutation\b([^>]*)>([\s\S]*?)<\/mutation>/g)].map((match): NormalizedMutant => {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    const status = attr(attrs, 'status') ?? (attr(attrs, 'detected') === 'true' ? 'KILLED' : 'SURVIVED');
    const filePath = tag(body, 'sourceFile') ?? 'unknown.java';
    const line = Number(tag(body, 'lineNumber') ?? 1);
    const description = tag(body, 'description') ?? undefined;

    return {
      status: mapEngineStatus(status),
      engineStatus: status,
      filePath,
      line: Number.isFinite(line) && line > 0 ? line : 1,
      mutatorName: tag(body, 'mutator') ?? 'PIT',
      replacement: description,
      description,
      coveringTests: [],
      engineMetadata: {
        mutatedClass: tag(body, 'mutatedClass'),
        mutatedMethod: tag(body, 'mutatedMethod'),
        methodDescription: tag(body, 'methodDescription'),
        indexes: tag(body, 'indexes'),
        blocks: tag(body, 'blocks')
      }
    };
  });

  return {
    version: '1',
    runner: {
      id: 'pit-alpha',
      name: 'PIT alpha',
      language: 'java'
    },
    scope: {
      changedFiles: [],
      mutatedFiles: uniqueFiles(mutants)
    },
    summary: summarize(mutants),
    mutants,
    limitations: javaAlphaLimitations(),
    engineMetadata: {
      source: 'pit-alpha'
    }
  };
}

function attr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1];
}

function tag(body: string, name: string): string | undefined {
  const match = body.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match?.[1]?.trim();
}

function summarize(mutants: NormalizedMutant[]): NormalizedMutationReport['summary'] {
  const killed = mutants.filter((mutant) => mutant.status === 'killed').length;
  const survived = mutants.filter((mutant) => mutant.status === 'survived').length;
  const noCoverage = mutants.filter((mutant) => mutant.status === 'noCoverage').length;
  const timeout = mutants.filter((mutant) => mutant.status === 'timeout').length;
  const runtimeError = mutants.filter((mutant) => mutant.status === 'runtimeError').length;
  const compileError = mutants.filter((mutant) => mutant.status === 'compileError').length;
  const ignored = mutants.filter((mutant) => mutant.status === 'ignored').length;
  const total = mutants.length;

  return {
    mutationScore: total === ignored ? null : total === 0 ? null : (killed / Math.max(1, total - ignored)) * 100,
    total,
    killed,
    survived,
    noCoverage,
    timeout,
    runtimeError,
    compileError,
    ignored
  };
}

function javaAlphaLimitations() {
  return [
    {
      code: 'java-alpha-parser-only',
      severity: 'warning' as const,
      message: 'PIT support is an alpha parser prototype. Tautest does not run Maven, Gradle, or PIT yet.'
    },
    {
      code: 'java-source-class-mapping',
      severity: 'warning' as const,
      message: 'PIT class-to-source mapping can be coarse and must be verified before review annotations.'
    }
  ];
}

function uniqueFiles(mutants: NormalizedMutant[]): string[] {
  return [...new Set(mutants.map((mutant) => mutant.filePath))].sort();
}
