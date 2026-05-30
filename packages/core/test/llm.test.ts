import { describe, expect, it } from 'vitest';
import { buildLlmProvenance, buildLlmSuggestionMarkdown, redactPromptForLlm } from '../src';

describe('LLM safety helpers', () => {
  it('redacts common secret shapes before provider handoff', () => {
    const result = redactPromptForLlm(`OPENAI_API_KEY=sk-proj_12345678901234567890
Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456
const cfg = { npmToken: "npm_123456789012345678901234" };
-----BEGIN PRIVATE KEY-----
secret
-----END PRIVATE KEY-----
`);

    expect(result.text).toContain('OPENAI_API_KEY=[REDACTED:OPENAI_API_KEY]');
    expect(result.text).toContain('Bearer [REDACTED:bearer-token]');
    expect(result.text).toContain('"[REDACTED:npmToken]"');
    expect(result.text).toContain('[REDACTED:private-key]');
    expect(result.text).not.toContain('sk-proj_12345678901234567890');
    expect(result.redactions.map((redaction) => redaction.label)).toEqual(
      expect.arrayContaining(['secret-assignment', 'bearer-token', 'secret-property', 'private-key'])
    );
  });

  it('records deterministic provenance for the prompt sent to a provider', () => {
    const provenance = buildLlmProvenance({
      provider: 'external-command',
      model: 'mock-model',
      prompt: 'write a test',
      redaction: {
        enabled: true,
        count: 0,
        labels: []
      },
      createdAt: '2026-05-25T00:00:00.000Z'
    });

    expect(provenance).toMatchObject({
      provider: 'external-command',
      model: 'mock-model',
      promptSha256: 'dfe59d37aff9a66c0995385aa4efeac27a157a1f0f93893e24ff7d232fd16260',
      promptBytes: 12,
      createdAt: '2026-05-25T00:00:00.000Z'
    });
  });

  it('writes provider suggestions with prompt provenance', () => {
    const markdown = buildLlmSuggestionMarkdown({
      provenance: {
        provider: 'external-command',
        model: 'mock-model',
        promptSha256: 'abc123',
        promptBytes: 42,
        redaction: {
          enabled: true,
          count: 1,
          labels: ['provider-token']
        },
        createdAt: '2026-05-25T00:00:00.000Z'
      },
      suggestion: 'Add a test.',
      promptPreview: 'Prompt body'
    });

    expect(markdown).toContain('# Tautest LLM Suggestion');
    expect(markdown).toContain('Prompt SHA-256: abc123');
    expect(markdown).toContain('Redaction: enabled, 1 replacement (provider-token)');
    expect(markdown).toContain('Add a test.');
    expect(markdown).toContain('Prompt body');
  });
});

describe('buildLlmSuggestionMarkdown fence selection', () => {
  it('uses 4 backticks when prompt contains a triple-backtick code block', () => {
    const provenance = buildLlmProvenance({
      provider: 'external-command',
      prompt: 'p',
      redaction: { enabled: false, count: 0, labels: [] },
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    const markdown = buildLlmSuggestionMarkdown({
      provenance,
      suggestion: 'Here is a fix.',
      promptPreview: 'Code:\n```\nconsole.log("hi")\n```'
    });

    expect(markdown).toContain('````markdown');
    expect(markdown).toMatch(/^````markdown$/m);
  });

  it('uses 5 backticks when prompt contains a 4-backtick fence', () => {
    const provenance = buildLlmProvenance({
      provider: 'external-command',
      prompt: 'p',
      redaction: { enabled: false, count: 0, labels: [] },
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    const markdown = buildLlmSuggestionMarkdown({
      provenance,
      suggestion: 'Fix.',
      promptPreview: 'Block:\n````\ncontent\n````'
    });

    expect(markdown).toContain('`````markdown');
  });

  it('returns _No suggestion returned._ when suggestion is empty', () => {
    const provenance = buildLlmProvenance({
      provider: 'external-command',
      prompt: 'p',
      redaction: { enabled: false, count: 0, labels: [] },
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    const markdown = buildLlmSuggestionMarkdown({
      provenance,
      suggestion: '   ',
      promptPreview: 'prompt'
    });

    expect(markdown).toContain('_No suggestion returned._');
  });
});
