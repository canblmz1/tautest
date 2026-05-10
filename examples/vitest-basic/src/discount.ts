export function calculateDiscount(age: number, subtotal: number): number {
  if (age >= 65) {
    return roundCurrency(subtotal * 0.2);
  }

  if (subtotal >= 100) {
    return roundCurrency(subtotal * 0.1);
  }

  return 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
