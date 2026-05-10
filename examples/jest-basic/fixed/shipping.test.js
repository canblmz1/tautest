const { calculateShipping } = require('../src/shipping');

describe('calculateShipping fixed threshold coverage', () => {
  it('gives non-members free shipping at the exact cart threshold', () => {
    expect(calculateShipping(100, false)).toBe(0);
  });
});
