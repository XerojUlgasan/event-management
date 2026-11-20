import type { IncludedServiceTerms } from "@event-management/contracts/catalog";

export function includedServiceTermsLines(terms?: IncludedServiceTerms) {
  return [
    "Included in the package price; no separate base service charge.",
    terms?.includedHours != null
      ? `Included hours: ${terms.includedHours}`
      : "Included hours: not specified",
    terms?.hourlyRatePesos != null
      ? `Excess hourly rate: PHP ${terms.hourlyRatePesos} per hour`
      : "Excess hourly rate: not specified",
  ];
}
