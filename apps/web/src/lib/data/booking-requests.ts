import type { PackagePrice } from "@event-management/contracts/catalog";
import type { BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests";
import { request } from "../http";

export type BookingStatus =
  | "under_review"
  | "needs_details"
  | "accepted"
  | "declined"
  | "cancelled";
export type BookingRequestInput = {
  packageId: string;
  packageUpdatedAt?: string;
  eventType: string;
  durationMode: "one_day" | "multi_day";
  requestedDays: { date: string }[];
  timeZone: string;
  contactName: string;
  phoneNumber: string;
  specialRequests?: string;
};
export type BookingRequest = Omit<
  BookingRequestInput,
  | "specialRequests"
  | "preferredDate"
  | "estimatedDuration"
  | "estimatedDurationDays"
  | "durationMode"
  | "requestedDays"
> & {
  requestedDays: { date: string; startsAt: string | null; endsAt: string | null; eventDayId?: string; operationalSchedule: { id: string; day: string; startsAt: string; endsAt: string; timeZone: string; status: string } | null }[] | null;
  durationMode: "one_day" | "multi_day" | null;
  requestedDayCount: number | null;
  preferredDate: string | null;
  estimatedDuration: BookingEstimatedDuration | null;
  estimatedDurationDays: number | null;
  guestCount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  preferredVenueLocation: string | null;
  specialRequests: string | null;
  id: string;
  reference: string;
  customerId: string;
  packageName: string;
  packagePrice: PackagePrice;
  packageMaxGuests: number;
  status: BookingStatus;
  outOfRange: boolean;
  createdAt: string;
  updatedAt: string;

};
export type BookingRequestFilters = {
  status?: BookingStatus;
  preferredDate?: string;
  cursor?: string;
  limit?: number;
};

export const createBookingRequest = (body: BookingRequestInput) =>
  request<{ bookingRequest: BookingRequest }>("/booking-requests", body);
export const getMyBookingRequests = (cursor?: string) =>
  request<{ bookingRequests: BookingRequest[]; nextCursor: string | null }>(`/booking-requests/mine${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
export const getMyBookingRequest = (id: string) =>
  request<{ bookingRequest: BookingRequest }>(
    `/booking-requests/${encodeURIComponent(id)}`,
  );
export const getAdminBookingRequest = (id: string) =>
  request<{ bookingRequest: BookingRequest }>(
    `/admin/booking-requests/${encodeURIComponent(id)}`,
  );
export const getAdminBookingRequestsPage = (filters: BookingRequestFilters) => {
  const query = new URLSearchParams();
  if (filters.limit) query.set("limit", String(filters.limit));
  if (filters.status) query.set("status", filters.status);
  if (filters.preferredDate) query.set("preferredDate", filters.preferredDate);
  if (filters.cursor) query.set("cursor", filters.cursor);
  return request<{
    bookingRequests: BookingRequest[];
    nextCursor: string | null;
  }>(`/admin/booking-requests?${query}`);
};
export const getBookingRequestCalendar = (
  month: string,
  status?: BookingStatus,
) => {
  const query = new URLSearchParams({ month });
  if (status) query.set("status", status);
  return request<{ dailyCounts: { preferredDate: string; count: number }[] }>(
    `/admin/booking-requests/calendar?${query}`,
  );
};
export const updateBookingRequestStatus = (
  id: string,
  status: BookingStatus,
  reason?: string,
) =>
  request<{ bookingRequest: BookingRequest }>(
    `/admin/booking-requests/${encodeURIComponent(id)}/status`,
    { status, ...(reason ? { reason } : {}) },
    undefined,
    "PATCH",
  );
export const cancelMyBookingRequest = (id: string, reason: string) =>
  request<{ bookingRequest: BookingRequest }>(
    `/booking-requests/${encodeURIComponent(id)}/cancel`,
    { reason },
    undefined,
    "PATCH",
  );

export const updateRequestedDayTimes = (id: string, date: string, body: { startsAt: string; endsAt: string; expectedUpdatedAt: string }) =>
  request<{ bookingRequest: BookingRequest }>(`/booking-requests/${encodeURIComponent(id)}/requested-days/${encodeURIComponent(date)}/times`, body, undefined, "PATCH");

export type BookingStatusHistoryEntry = { id: string; status: BookingStatus; reason: string | null; changedBy: string; createdAt: string };
export const getBookingStatusHistory = (id: string, admin: boolean, cursor?: string) =>
  request<{ history: BookingStatusHistoryEntry[]; nextCursor: string | null }>(`${admin ? "/admin" : ""}/booking-requests/${encodeURIComponent(id)}/status-history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
