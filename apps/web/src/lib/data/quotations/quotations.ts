import type {
  Quotation,
  QuotationItem,
} from "@event-management/contracts/quotations";
import { request } from "../../http/request";

export type {
  Quotation,
  QuotationItem,
} from "@event-management/contracts/quotations";

const quote = (id: string) => `/quotations/${encodeURIComponent(id)}`;

export const getQuotations = (
  id: string,
  admin: boolean,
  options: { cursor?: string; quotationId?: string } = {},
) => {
  const query = new URLSearchParams();

  query.set("limit", "5");

  if (options.cursor) query.set("cursor", options.cursor);

  if (options.quotationId) query.set("quotationId", options.quotationId);

  return request<{
    quotations: Quotation[];
    nextCursor: string | null;
    currentDraft: Quotation | null;
    currentOffer: Quotation | null;
    previousDraftVersion: number | null;
  }>(
    `${admin ? "/admin" : ""}/booking-requests/${encodeURIComponent(id)}/quotations?${query}`,
  );
};

export const getQuotation = (id: string) =>
  request<{ quotation: Quotation }>(quote(id));

export const createQuotation = (id: string, expectedUpdatedAt: string) =>
  request<{ quotation: Quotation }>(
    `/admin/booking-requests/${encodeURIComponent(id)}/quotations`,
    { expectedUpdatedAt },
  );

export const saveQuotation = (
  id: string,
  expectedUpdatedAt: string,
  items: QuotationItem[],
) =>
  request<{ quotation: Quotation }>(
    `/admin${quote(id)}`,
    { expectedUpdatedAt, items },
    undefined,
    "PATCH",
  );

export const sendQuotation = (id: string, expectedUpdatedAt: string) =>
  request<{ quotation: Quotation }>(`/admin${quote(id)}/send`, {
    expectedUpdatedAt,
  });

export const reviseQuotation = (
  id: string,
  expectedUpdatedAt: string,
  reason: string,
) =>
  request<{ quotation: Quotation }>(`/admin${quote(id)}/revision`, {
    expectedUpdatedAt,
    reason,
  });

export const acceptQuotation = (id: string, expectedUpdatedAt: string) =>
  request<{ quotation: Quotation }>(`${quote(id)}/accept`, {
    expectedUpdatedAt,
  });

export const requestRevision = (id: string, expectedUpdatedAt: string) =>
  request<{ quotation: Quotation }>(`${quote(id)}/request-revision`, {
    expectedUpdatedAt,
  });
