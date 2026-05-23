import { calculateShipping } from './shipping';

describe('calculateShipping', () => {
  it('gives members free shipping', () => {
    expect(calculateShipping(20, true)).toBe(0);
  });

  it('charges non-members below the threshold', () => {
    expect(calculateShipping(99, false)).toBe(8);
  });
});
