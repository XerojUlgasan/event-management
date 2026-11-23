import type { ServicePricing } from "@event-management/contracts/catalog";
import {
  centavosToPesos,
  pesosToCentavos,
} from "@event-management/contracts/money";
import { calculateQuotationAddonAmount } from "@event-management/contracts/quotations";

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

export function bookingHoursLabel(hours: number | null) {
  if (hours == null) return "Hours open";

  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export function bookingOfferAmountLabel(
  offer: ServicePricing & { totalHours: number | null },
) {
  if (offer.totalHours == null) return null;

  const hours =
    offer.includedHours != null
      ? Math.max(0, offer.totalHours - offer.includedHours)
      : offer.totalHours;
  const amount = calculateQuotationAddonAmount({
    source: {
      packageId: "booking",
      addonId: "booking",
      fixedPriceMinor:
        offer.fixedPricePesos == null
          ? null
          : pesosToCentavos(offer.fixedPricePesos),
      includedHours: offer.includedHours,
      hourlyRateMinor:
        offer.hourlyRatePesos == null
          ? null
          : pesosToCentavos(offer.hourlyRatePesos),
    },
    fixedPriceOverrideMinor: null,
    hourlyRateOverrideMinor: null,
    hours,
  });

  if (amount.amountMinor == null) return null;

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(centavosToPesos(amount.amountMinor));
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
