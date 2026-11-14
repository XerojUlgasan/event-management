export type QuotationDirection = "add" | "deduct";
export type QuotationKind =
  "addition" | "deduction" | "substitution" | "adjustment";
export type QuotationStatus = "draft" | "sent" | "accepted" | "superseded";
export type QuotationItem = {
  id: string;
  direction: QuotationDirection;
  kind: QuotationKind;
  description: string;
  amountMinor: number;
  serviceId: string | null;
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
  acceptedAt: string | null;
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
