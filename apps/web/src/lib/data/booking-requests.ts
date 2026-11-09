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
  preferredDate: string;
  estimatedDuration: BookingEstimatedDuration;
  estimatedDurationDays?: number;
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
> & {
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
  statusHistory: {
    status: BookingStatus;
    reason: string | null;
    changedBy: string;
    createdAt: string;
  }[];
};
export type BookingRequestFilters = {
  status?: BookingStatus;
  preferredDate?: string;
  cursor?: string;
  limit: number;
};

export const createBookingRequest = (body: BookingRequestInput) =>
  request<{ bookingRequest: BookingRequest }>("/booking-requests", body);
export const getMyBookingRequests = () =>
  request<{ bookingRequests: BookingRequest[] }>("/booking-requests/mine");
export const getMyBookingRequest = (id: string) =>
  request<{ bookingRequest: BookingRequest }>(
    `/booking-requests/${encodeURIComponent(id)}`,
  );
export const getAdminBookingRequest = (id: string) =>
  request<{ bookingRequest: BookingRequest }>(
    `/admin/booking-requests/${encodeURIComponent(id)}`,
  );
export const getAdminBookingRequests = () =>
  request<{ bookingRequests: BookingRequest[] }>("/admin/booking-requests");
export const getAdminBookingRequestsPage = (filters: BookingRequestFilters) => {
  const query = new URLSearchParams({ limit: String(filters.limit) });
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
