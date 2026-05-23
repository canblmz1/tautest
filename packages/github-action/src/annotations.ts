import * as core from '@actions/core';

export interface AnnotationMutant {
  filePath: string;
  line: number;
  mutatorName: string;
  original: string;
  replacement: string;
  insight?: {
    missingBehavior?: string;
  };
}

export interface Annotation {
  file: string;
  line: number;
  title: string;
  message: string;
}

export function buildSurvivorAnnotations(
  mutants: AnnotationMutant[],
  options: {
    maxAnnotations?: number;
  } = {}
): Annotation[] {
  const maxAnnotations = options.maxAnnotations ?? 10;

  return mutants.slice(0, maxAnnotations).map((mutant) => ({
    file: mutant.filePath,
    line: mutant.line,
    title: `Tautest survivor: ${mutant.mutatorName}`,
    message: [
      `${mutant.mutatorName} survived mutation testing.`,
      `Original: ${compact(mutant.original)}`,
      `Replacement: ${compact(mutant.replacement)}`,
      `Likely missing behavior: ${compact(mutant.insight?.missingBehavior || 'Add the smallest behavior-focused test that kills this mutant.')}`
    ].join('\n')
  }));
}

export function emitSurvivorAnnotations(mutants: AnnotationMutant[], options: { maxAnnotations?: number } = {}): number {
  const annotations = buildSurvivorAnnotations(mutants, options);

  for (const annotation of annotations) {
    core.warning(annotation.message, {
      title: annotation.title,
      file: annotation.file,
      startLine: annotation.line,
      endLine: annotation.line
    });
  }

  return annotations.length;
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
