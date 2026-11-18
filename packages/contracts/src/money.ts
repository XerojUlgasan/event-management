/** Whole PHP pesos stored in the database, and integer centavos on the wire. */
export function pesosToCentavos(pesos: number) {
  return Math.round(pesos * 100);
}

export function centavosToPesos(amountMinor: number) {
  return amountMinor / 100;
}
