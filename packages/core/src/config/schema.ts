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
      .optional(),
    stryker: z
      .object({
        incremental: z.boolean().optional(),
        incrementalFile: z.string().min(1).optional(),
        timeoutMS: z.number().int().positive().optional(),
        dryRunTimeoutMinutes: z.number().positive().optional(),
        concurrency: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
        userConfig: z.record(z.unknown()).optional()
      })
      .optional(),
    prompt: z
      .object({
        maxMutants: z.number().int().min(1).optional(),
        style: z.enum(['agent', 'human', 'claude-code', 'cursor', 'codex', 'opencode']).optional()
      })
      .optional()
  })
  .strict();

export type TautestConfigInput = z.input<typeof tautestConfigSchema>;
