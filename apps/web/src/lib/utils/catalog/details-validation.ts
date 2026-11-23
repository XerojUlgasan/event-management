import type {
  PackageContent,
  ServiceContent,
} from "@event-management/contracts/catalog";

export function validatePackageDetails(
  content: PackageContent,
): string | undefined {
  if (!content.name.trim()) return "Enter a package name.";

  if (
    !Number.isInteger(content.maxGuests) ||
    content.maxGuests < 1 ||
    content.maxGuests > 2147483647
  )
    return "Enter a positive whole number of guests.";

  if (
    !Number.isInteger(content.price.amountMinor) ||
    content.price.amountMinor < 1 ||
    content.price.amountMinor > 2147483647 ||
    content.price.amountMinor % 100 !== 0
  )
    return "Enter a positive whole peso package price.";
}

export function validateServiceDetails(
  content: ServiceContent,
): string | undefined {
  if (!content.name.trim()) return "Enter a service name.";

  if (!content.description.trim()) return "Enter a catalog description.";

  if ((content.fixedPricePesos == null) !== (content.includedHours == null))
    return "Enter both the fixed price and included hours, or leave both blank for hourly-only pricing.";

  for (const [label, value] of [
    ["Fixed price", content.fixedPricePesos],
    ["Included hours", content.includedHours],
    ["Hourly rate", content.hourlyRatePesos],
  ] as const) {
    if (
      value != null &&
      (!Number.isInteger(value) || value <= 0 || value > 2147483647)
    )
      return `${label} must be a whole number greater than zero.`;
  }

  if (content.hourlyRatePesos == null) return "Enter an hourly rate.";
}
