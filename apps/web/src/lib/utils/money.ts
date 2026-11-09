export function pesosToCentavos(pesos: number) {
  return Math.round(pesos * 100)
}

export function centavosToPesos(amountMinor: number) {
  return amountMinor / 100
}
