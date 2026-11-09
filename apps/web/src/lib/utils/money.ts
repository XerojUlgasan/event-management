export function pesosToCentavos(pesos: number) {
  return Math.round(pesos * 100)
}

export function centavosToPesos(amountMinor: number) {
  return amountMinor / 100
}

export function priceLabel(price: { amountMinor: number } | null) {
  return price
    ? `${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(centavosToPesos(price.amountMinor))} total`
    : "Price on request"
}
