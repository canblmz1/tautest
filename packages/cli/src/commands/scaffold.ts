import path from 'node:path';
import { buildTestScaffold, type ScaffoldFramework, type ScaffoldLanguage } from '@tautest/core';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { fileExists, writeTextFile } from '../lib/fs';

export interface ScaffoldCommandOptions {
  language?: ScaffoldLanguage;
  framework?: ScaffoldFramework;
  out?: string;
  write?: boolean;
  force?: boolean;
  json?: boolean;
}

export function runScaffoldCommand(cwd: string, filePath: string, options: ScaffoldCommandOptions): string {
  const scaffold = buildTestScaffold({
    cwd,
    filePath,
    language: options.language,
    framework: options.framework
  });
  const outPath = path.resolve(cwd, options.out ?? scaffold.suggestedTestPath);

  if (options.write) {
    if (fileExists(outPath) && !options.force) {
      throw new CliError('Scaffold output already exists.', EXIT_CODES.configError, `Pass --force to overwrite: ${path.relative(cwd, outPath)}`);
    }

    writeTextFile(outPath, scaffold.code);
  }

  if (options.json) {
    return `${JSON.stringify(
      {
        status: options.write ? 'written' : 'preview',
        scaffold,
        paths: {
          output: outPath
        }
      },
      null,
      2
    )}\n`;
  }

  if (!options.write) {
    return scaffold.code;
  }

  return [
    `Scaffold written: ${path.relative(cwd, outPath) || outPath}`,
    `Language: ${scaffold.language}`,
    `Framework: ${scaffold.framework}`,
    `Detected functions: ${scaffold.detected.functions.length > 0 ? scaffold.detected.functions.join(', ') : 'none'}`,
    ...(scaffold.warnings.length > 0 ? ['', 'Warnings:', ...scaffold.warnings.map((warning) => `- ${warning}`)] : [])
  ].join('\n') + '\n';
}
