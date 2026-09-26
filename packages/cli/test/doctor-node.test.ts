import { describe, expect, it } from 'vitest';
import { checkNodeVersion } from '../src/lib/doctor';

describe('doctor Node.js check', () => {
  it('rejects Node 20, which is end-of-life and unsupported by Stryker 10', () => {
    expect(checkNodeVersion('20.19.5')).toMatchObject({ status: 'error', suggestion: 'Use Node.js 22 or newer.' });
  });

  it('accepts Node 22', () => {
    expect(checkNodeVersion('22.12.0').status).toBe('ok');
  });
});
