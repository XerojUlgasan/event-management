export function pesosToCentavos(pesos: number) {
  return Math.round(pesos * 100);
}

export function centavosToPesos(amountMinor: number) {
  return amountMinor / 100;
}

export function priceLabel(price: { amountMinor: number } | null) {
  return price
    ? `${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(centavosToPesos(price.amountMinor))} total`
    : "Price on request";
}
import type { ServicePricing } from "@event-management/contracts/catalog";

export function servicePricingLabels(service: ServicePricing) {
  const pesos = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);
  if (service.fixedPricePesos != null && service.includedHours != null) {
    return {
      price: `${pesos(service.fixedPricePesos)} for ${service.includedHours} ${service.includedHours === 1 ? "hour" : "hours"}`,
      excess: `${service.hourlyRatePesos == null ? "Rate on request" : pesos(service.hourlyRatePesos)} / additional hour`,
    };
  }
  return {
    price:
      service.hourlyRatePesos == null
        ? "Rate on request"
        : `${pesos(service.hourlyRatePesos)} / hour`,
    excess: null,
  };
}
