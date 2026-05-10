const { calculateShipping } = require('./shipping');

describe('calculateShipping', () => {
  it('gives members free shipping', () => {
    expect(calculateShipping(25, true)).toBe(0);
  });

  it('charges non-members below the free shipping threshold', () => {
    expect(calculateShipping(40, false)).toBe(7);
  });
});
