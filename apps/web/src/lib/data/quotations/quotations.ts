import type {
  Quotation,
  QuotationPreparation,
  SendQuotationInput,
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

  if (options.cursor) query.set("cursor", options.cursor);

  if (options.quotationId) query.set("quotationId", options.quotationId);

  return request<{
    quotations: Quotation[];
    nextCursor: string | null;
    currentOffer: Quotation | null;
  }>(
    `${admin ? "/admin" : ""}/booking-requests/${encodeURIComponent(id)}/quotations?${query}`,
  );
};

export const getQuotation = (id: string) =>
  request<{ quotation: Quotation }>(quote(id));

export const prepareQuotation = (id: string) =>
  request<{ preparation: QuotationPreparation }>(
    `/admin/booking-requests/${encodeURIComponent(id)}/quotations/prepare`,
  );

export const sendQuotation = (id: string, body: SendQuotationInput) =>
  request<{ quotation: Quotation }>(
    `/admin/booking-requests/${encodeURIComponent(id)}/quotations/send`,
    body,
  );
