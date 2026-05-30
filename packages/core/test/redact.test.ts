import { describe, it, expect } from 'vitest';
import { redactPromptForLlm } from '../src/llm/redact';

describe('redactPromptForLlm', () => {
  it('passes through text without sensitive data unchanged', () => {
    const input = 'This is a plain prompt about fixing mutation tests.';
    const result = redactPromptForLlm(input);

    expect(result.text).toBe(input);
    expect(result.redactions).toHaveLength(0);
  });

  it('redacts PEM private keys', () => {
    const input = 'key: -----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';
    const result = redactPromptForLlm(input);

    expect(result.text).toContain('[REDACTED:private-key]');
    expect(result.text).not.toContain('MIIEpAIBAAKCAQEA');
    expect(result.redactions.some((r) => r.label === 'private-key')).toBe(true);
  });

  it('redacts EC private keys', () => {
    const input = '-----BEGIN EC PRIVATE KEY-----\nabc123\n-----END EC PRIVATE KEY-----';
    const result = redactPromptForLlm(input);

    expect(result.text).toContain('[REDACTED:private-key]');
  });

  it('redacts bearer tokens', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature';
    const result = redactPromptForLlm(input);

    expect(result.text).toContain('Bearer [REDACTED:bearer-token]');
    expect(result.text).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(result.redactions.some((r) => r.label === 'bearer-token')).toBe(true);
  });

  it('redacts secret environment variable assignments', () => {
    const input = 'MY_API_KEY="super-secret-value-here-long-enough"';
    const result = redactPromptForLlm(input);

    expect(result.text).toContain('[REDACTED:MY_API_KEY]');
    expect(result.text).not.toContain('super-secret-value-here');
    expect(result.redactions.some((r) => r.label === 'secret-assignment')).toBe(true);
  });

  it('redacts TOKEN environment variable assignments', () => {
    const input = "GITHUB_TOKEN='ghp_abcdefghijklmnopqrstuvwxyz12345'";
    const result = redactPromptForLlm(input);

    expect(result.text).toContain('[REDACTED:GITHUB_TOKEN]');
  });

  it('redacts OpenAI-style provider tokens', () => {
    const input = 'token: sk-abcdefghijklmnopqrstuvwxyz12345678901234';
    const result = redactPromptForLlm(input);

    expect(result.text).toContain('[REDACTED:provider-token]');
    expect(result.redactions.some((r) => r.label === 'provider-token')).toBe(true);
  });

  it('redacts GitHub personal access tokens', () => {
    const input = 'export GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';
    const result = redactPromptForLlm(input);

    expect(result.text).toContain('[REDACTED');
  });

  it('counts multiple occurrences of the same redaction type', () => {
    const input = [
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload1.sig1',
      'Bearer eyJhbGciOiJSUzI1NiJ9.payload2.sig2'
    ].join(' and ');
    const result = redactPromptForLlm(input);

    const bearerRedaction = result.redactions.find((r) => r.label === 'bearer-token');

    expect(bearerRedaction?.count).toBe(2);
  });

  it('returns each label at most once in the redactions array', () => {
    const input = 'Bearer tokenAAAAAAAAAAAAAAAAAAAA and Bearer tokenBBBBBBBBBBBBBBBBBBBB';
    const result = redactPromptForLlm(input);

    const labels = result.redactions.map((r) => r.label);
    const uniqueLabels = new Set(labels);

    expect(labels.length).toBe(uniqueLabels.size);
  });

  it('throws for inputs exceeding the 10MB size limit', () => {
    // Build a string that just exceeds 10MB using Buffer to avoid slow string concat
    const limit = 10 * 1024 * 1024;
    const oversized = Buffer.alloc(limit + 1, 0x61).toString('utf8'); // 'a' * (10MB + 1)

    expect(() => redactPromptForLlm(oversized)).toThrow(/10MB limit/);
  });

  it('does not throw for inputs within the size limit', () => {
    expect(() => redactPromptForLlm('plain text with no secrets')).not.toThrow();
  });
});
