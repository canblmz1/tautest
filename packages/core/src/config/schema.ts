import { z } from 'zod';

export const tautestConfigSchema = z
  .object({
    baseRef: z.string().min(1).optional(),
    outputDir: z.string().min(1).optional(),
    sourceFileExtensions: z.array(z.string().startsWith('.')).optional(),
    rangeCoalesceGap: z.number().int().min(0).optional(),
    testRunner: z.enum(['auto', 'vitest', 'jest']).optional(),
    score: z
      .object({
        strong: z.number().min(0).max(100).optional(),
        mixed: z.number().min(0).max(100).optional(),
        topMutants: z.number().int().min(1).optional()
      })
      .refine(
        (data) => {
          if (data.strong !== undefined && data.mixed !== undefined) {
            return data.strong >= data.mixed;
          }
          return true;
        },
        { message: 'score.strong must be greater than or equal to score.mixed' }
      )
      .optional(),
    stryker: z
      .object({
        incremental: z.boolean().optional(),
        incrementalFile: z.string().min(1).optional(),
        timeoutMS: z.number().int().positive().optional(),
        dryRunTimeoutMinutes: z.number().positive().optional(),
        concurrency: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
        vitestConfigFile: z.string().min(1).optional(),
        jestConfigFile: z.string().min(1).optional(),
        userConfig: z.record(z.unknown()).optional()
      })
      .optional(),
    prompt: z
      .object({
        maxMutants: z.number().int().min(1).optional(),
        style: z.enum(['agent', 'human', 'claude-code', 'cursor', 'codex', 'opencode']).optional()
      })
      .optional(),
    llm: z
      .object({
        enabled: z.boolean().optional(),
        provider: z.enum(['external-command']).optional(),
        model: z.string().min(1).optional(),
        command: z.string().min(1).optional(),
        commandArgs: z.array(z.string()).optional(),
        redact: z.boolean().optional()
      })
      .optional()
  })
  .strict();

export type TautestConfigInput = z.input<typeof tautestConfigSchema>;
