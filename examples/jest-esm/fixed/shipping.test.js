import { describe, expect, it } from '@jest/globals';
import { calculateShipping } from '../src/shipping.js';

describe('calculateShipping', () => {
  it('gives members free shipping', () => {
    expect(calculateShipping(20, true)).toBe(0);
  });

  it('charges non-members below the threshold', () => {
    expect(calculateShipping(99, false)).toBe(8);
  });

  it('gives non-members free shipping at the exact threshold', () => {
    expect(calculateShipping(100, false)).toBe(0);
  });
});
