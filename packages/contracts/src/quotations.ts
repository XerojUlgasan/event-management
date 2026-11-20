export type QuotationDirection = "add" | "deduct";

export type QuotationKind =
  "addition" | "deduction" | "substitution" | "adjustment";

export type QuotationStatus = "draft" | "sent" | "superseded";

export type ManualQuotationItem = {
  id: string;
  direction: QuotationDirection;
  kind: QuotationKind;
  description: string;
  amountMinor: number;
  serviceId: string | null;
  addon?: never;
};

export type QuotationAddonSource = {
  packageId: string;
  addonId: string;
  fixedPriceMinor: number | null;
  includedHours: number | null;
  hourlyRateMinor: number | null;
};

export type QuotationAddonTerms = {
  fixedPriceOverrideMinor: number | null;
  hourlyRateOverrideMinor: number | null;
  /** Extra hours for fixed pricing, booked hours for hourly-only pricing. */
  hours: number | null;
};

export type QuotationAddonItem = {
  id: string;
  direction: "add";
  kind: "addition";
  description: string;
  amountMinor: number | null;
  serviceId: string;
  addon: QuotationAddonTerms & {
    source: QuotationAddonSource;
    requiresRemoval?: "included" | "archived";
  };
};

export type QuotationItem = ManualQuotationItem | QuotationAddonItem;

export type QuotationItemInput =
  | (ManualQuotationItem & { serviceId: null })
  | { id: string; addon: { hours: number } };

type QuotationOfferRevision = { id: string; updatedAt: string };

type QuotationSource = {
  expectedBookingUpdatedAt: string;
  packageId: string;
  expectedPackageUpdatedAt: string;
  currentOffer: QuotationOfferRevision | null;
};

export type QuotationPreparation = QuotationSource & {
  bookingRequestId: string;
  baseAmountMinor: number;
  items: QuotationItem[];
};

export type SendQuotationInput = QuotationSource & {
  requestId: string;
  revisionReason: string | null;
  items: QuotationItemInput[];
};

export type Quotation = {
  id: string;
  bookingRequestId: string;
  version: number;
  currency: "PHP";
  baseAmountMinor: number;
  totalAmountMinor: number;
  status: QuotationStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  supersededAt: string | null;
  offeredPackageId: string | null;
  adjustmentsReviewed: boolean;
  previousQuotationId: string | null;
  revisionReason: string | null;
  items: QuotationItem[];
};

export const MAX_QUOTATION_ITEMS = 100;
export const MAX_QUOTATION_DESCRIPTION_LENGTH = 4000;
export const MAX_QUOTATION_REASON_LENGTH = 1000;
export const MAX_QUOTATION_AMOUNT_MINOR = 2147483647;
export const MAX_QUOTATION_HOURS = 2147483647;

type QuotationAddonAmount =
  | { status: "ready"; amountMinor: number }
  | { status: "pending" | "out_of_range"; amountMinor: null };

export function calculateQuotationAddonAmount({
  source,
  fixedPriceOverrideMinor,
  hourlyRateOverrideMinor,
  hours,
}: QuotationAddonItem["addon"]): QuotationAddonAmount {
  const fixed = source.includedHours !== null;
  const base = fixed ? (fixedPriceOverrideMinor ?? source.fixedPriceMinor) : 0;
  const rate = hourlyRateOverrideMinor ?? source.hourlyRateMinor;
  const billableHours = hours ?? 0;

  const invalidOverride = [
    fixedPriceOverrideMinor,
    hourlyRateOverrideMinor,
  ].some(
    (value) =>
      value !== null &&
      (!Number.isSafeInteger(value) ||
        value < 0 ||
        value > MAX_QUOTATION_AMOUNT_MINOR),
  );

  if (
    invalidOverride ||
    (!fixed && fixedPriceOverrideMinor !== null) ||
    !Number.isSafeInteger(billableHours) ||
    billableHours < 0 ||
    billableHours > MAX_QUOTATION_HOURS
  )
    return { status: "out_of_range", amountMinor: null };

  if (
    base === null ||
    (!fixed && !billableHours) ||
    (billableHours && rate === null)
  )
    return { status: "pending", amountMinor: null };

  // Check the bound before multiplying. Source rates can exceed the quote limit.
  if (
    base > MAX_QUOTATION_AMOUNT_MINOR ||
    (billableHours > 0 &&
      (rate ?? 0) >
        Math.floor((MAX_QUOTATION_AMOUNT_MINOR - base) / billableHours))
  )
    return { status: "out_of_range", amountMinor: null };

  return { status: "ready", amountMinor: base + billableHours * (rate ?? 0) };
}
