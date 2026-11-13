import type {
  Quotation,
  QuotationItem,
} from "@event-management/contracts/quotations";
import { request } from "../http";
export type {
  Quotation,
  QuotationItem,
} from "@event-management/contracts/quotations";
const quote = (id: string) => `/quotations/${encodeURIComponent(id)}`;
export const getQuotations = (id: string, admin: boolean) =>
  request<{ quotations: Quotation[] }>(
    `${admin ? "/admin" : ""}/booking-requests/${encodeURIComponent(id)}/quotations`,
  );
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
  request<{ quotation: Quotation }>(
    `/admin${quote(id)}/revision`,
    { expectedUpdatedAt, reason },
  );
