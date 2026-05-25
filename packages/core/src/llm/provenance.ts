import { createHash } from 'node:crypto';
import type { LlmProvenance, LlmProvider, LlmRedactionSummary } from '../types';

export function buildLlmProvenance(input: {
  provider: LlmProvider;
  model?: string;
  prompt: string;
  redaction: LlmRedactionSummary;
  createdAt?: string;
}): LlmProvenance {
  const bytes = Buffer.byteLength(input.prompt, 'utf8');

  return {
    provider: input.provider,
    model: input.model,
    promptSha256: createHash('sha256').update(input.prompt).digest('hex'),
    promptBytes: bytes,
    redaction: input.redaction,
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}
