function calculateShipping(cartTotal, isMember) {
  if (isMember || cartTotal >= 100) {
    return 0;
  }

  return 7;
}

module.exports = { calculateShipping };
