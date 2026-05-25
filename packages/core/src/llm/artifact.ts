import type { LlmProvenance } from '../types';

export function buildLlmSuggestionMarkdown(input: { provenance: LlmProvenance; suggestion: string; promptPreview: string }): string {
  const promptFence = chooseFence(input.promptPreview);

  return `# Tautest LLM Suggestion

Provider: ${input.provenance.provider}
Model: ${input.provenance.model ?? 'unspecified'}
Prompt SHA-256: ${input.provenance.promptSha256}
Prompt bytes: ${input.provenance.promptBytes}
Redaction: ${formatRedaction(input.provenance.redaction)}
Created: ${input.provenance.createdAt}

## Provider Suggestion

${input.suggestion.trim().length > 0 ? input.suggestion.trim() : '_No suggestion returned._'}

## Prompt Sent To Provider

${promptFence}markdown
${input.promptPreview}
${promptFence}
`;
}

function formatRedaction(redaction: LlmProvenance['redaction']): string {
  if (!redaction.enabled) {
    return 'disabled';
  }

  const labels = redaction.labels.length > 0 ? ` (${redaction.labels.join(', ')})` : '';
  return `enabled, ${redaction.count} replacement${redaction.count === 1 ? '' : 's'}${labels}`;
}

function chooseFence(value: string): string {
  const matches = value.match(/`{3,}/g) ?? [];
  const longest = matches.reduce((max, match) => Math.max(max, match.length), 2);
  return '`'.repeat(longest + 1);
}
