export interface LlmRedaction {
  label: string;
  count: number;
}

export interface LlmRedactionResult {
  text: string;
  redactions: LlmRedaction[];
}

type Replacement = string | ((match: string, ...captures: string[]) => string);

const MAX_REDACT_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB

export function redactPromptForLlm(prompt: string): LlmRedactionResult {
  if (Buffer.byteLength(prompt, 'utf8') > MAX_REDACT_INPUT_BYTES) {
    throw new Error(
      `redactPromptForLlm: input exceeds the ${MAX_REDACT_INPUT_BYTES / (1024 * 1024)}MB limit. Truncate the prompt before calling redact.`
    );
  }
  let text = prompt;
  const counts = new Map<string, number>();

  text = applyPattern(
    text,
    'private-key',
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
    '[REDACTED:private-key]',
    counts
  );
  text = applyPattern(
    text,
    'secret-assignment',
    /\b([A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_KEY|AUTH)[A-Za-z0-9_]*)\s*=\s*("[^"]+"|'[^']+'|`[^`]+`|[^\s]+)/gi,
    (_match, key: string) => `${key}=[REDACTED:${key}]`,
    counts
  );
  text = applyPattern(
    text,
    'secret-property',
    /(["']?)([A-Za-z0-9_]*(?:token|secret|password|apiKey|privateKey|accessKey|auth)[A-Za-z0-9_]*)(\1\s*:\s*)(["'`])([^"'`]{8,})(\4)/gi,
    (_match, quote: string, key: string, middle: string, valueQuote: string) => `${quote}${key}${middle}${valueQuote}[REDACTED:${key}]${valueQuote}`,
    counts
  );
  text = applyPattern(text, 'bearer-token', /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{20,}/gi, '$1[REDACTED:bearer-token]', counts);
  text = applyPattern(
    text,
    'provider-token',
    /\b(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9_]{20,})\b/g,
    '[REDACTED:provider-token]',
    counts
  );

  return {
    text,
    redactions: [...counts.entries()].map(([label, count]) => ({ label, count }))
  };
}

function applyPattern(text: string, label: string, pattern: RegExp, replacement: Replacement, counts: Map<string, number>): string {
  return text.replace(pattern, (...args: unknown[]) => {
    const match = String(args[0]);
    const captures = args.slice(1, -2).map((value) => String(value));
    const next = typeof replacement === 'function' ? replacement(match, ...captures) : replacement.replace(/\$(\d+)/g, (_token, index: string) => captures[Number(index) - 1] ?? '');

    if (next !== match) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return next;
  });
}
