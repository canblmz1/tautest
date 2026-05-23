export function calculateShipping(cartTotal: number, isMember: boolean): number {
  if (isMember) {
    return 0;
  }

  if (cartTotal >= 100) {
    return 0;
  }

  return 8;
}
