import type { ServicePricing } from "@event-management/contracts/catalog";
import {
  centavosToPesos,
  pesosToCentavos,
} from "@event-management/contracts/money";

export { centavosToPesos, pesosToCentavos };

export function formatPesosFromMinor(amountMinor: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(centavosToPesos(amountMinor));
}

export function formatSignedPesosFromMinor(amountMinor: number) {
  const formatted = formatPesosFromMinor(Math.abs(amountMinor));
  if (amountMinor > 0) return `+${formatted}`;
  if (amountMinor < 0) return `−${formatted}`;
  return formatted;
}

export function priceLabel(price: { amountMinor: number } | null) {
  return price
    ? `${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(centavosToPesos(price.amountMinor))} total`
    : "Price on request";
}

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
