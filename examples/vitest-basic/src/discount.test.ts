import { describe, expect, it } from 'vitest';
import { calculateDiscount } from './discount';

describe('calculateDiscount', () => {
  it('applies the senior discount for customers above 65', () => {
    expect(calculateDiscount(70, 100)).toBe(20);
  });

  it('applies the subtotal discount at 100', () => {
    expect(calculateDiscount(30, 100)).toBe(10);
  });

  it('returns zero when no discount rule matches', () => {
    expect(calculateDiscount(30, 40)).toBe(0);
  });
});

