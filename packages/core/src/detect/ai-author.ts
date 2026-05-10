import type { AiAuthorDetection } from '../types';

export function detectAiAuthor(env: Record<string, string | undefined> = process.env): AiAuthorDetection {
  if (env.CODEX_SANDBOX || env.CODEX_HOME || env.OPENAI_CODEX) {
    return {
      author: 'codex',
      confidence: 'high',
      reason: 'Codex-specific environment variables detected.'
    };
  }

  if (env.CURSOR_TRACE_ID || env.CURSOR_WORKSPACE_ID) {
    return {
      author: 'cursor',
      confidence: 'high',
      reason: 'Cursor-specific environment variables detected.'
    };
  }

  if (env.CLAUDECODE || env.CLAUDE_CODE || env.ANTHROPIC_API_KEY) {
    return {
      author: 'claude',
      confidence: env.ANTHROPIC_API_KEY ? 'medium' : 'high',
      reason: 'Claude-related environment variables detected.'
    };
  }

  return {
    author: 'unknown',
    confidence: 'low',
    reason: 'No known AI-author environment signal detected.'
  };
}

