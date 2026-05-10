import { describe, expect, it } from 'vitest';
import { calculateDiscount } from '../src/discount';

describe('calculateDiscount fixed boundary coverage', () => {
  it('applies the senior discount at the exact age boundary', () => {
    expect(calculateDiscount(65, 100)).toBe(20);
  });
});
