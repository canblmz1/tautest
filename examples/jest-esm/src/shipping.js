export function calculateShipping(cartTotal, isMember) {
  if (isMember) {
    return 0;
  }

  if (cartTotal >= 100) {
    return 0;
  }

  return 8;
}
