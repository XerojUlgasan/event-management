import type {
  EventDayStaffRow,
  ResponseDeadlineDays,
} from "@event-management/contracts/event-days";
import type {
  PaginationQuery,
  PageInfo,
} from "@event-management/contracts/pagination";
import { request } from "../../http/request";
export type EventDay = {
  id: string;
  bookingRequestId: string;
  bookingReference: string;
  packageName: string;
  eventType: string;
  timezone: string;
  day: string;
  startsAt: string;
  endsAt: string;
  status: string;
  staffingStatus: "draft" | "open" | "closed";
  availabilityDeadline: string | null;
  replacementEventDayId: string | null;
  availability: {
    staffId: string;
    staffName: string;
    response: "available" | "unavailable";
    respondedAt: string;
  }[];
  assignments: {
    staffId: string;
    staffName: string;
    role: "coordinator" | "helper";
    status: "confirmed" | "cancelled";
    assignedAt: string;
  }[];
  ownAvailability: "available" | "unavailable" | null;
  ownAssignment: {
    role: "coordinator" | "helper";
    status: "confirmed" | "cancelled";
  } | null;
  eligibleStaff: {
    id: string;
    displayName: string;
  }[];
};
export type EventDaySchedule = {
  day: string;
  startsAt: string;
  endsAt: string;
  staffingStatus: "draft" | "open";
  daysBefore?: ResponseDeadlineDays;
};
const path = (id: string) => encodeURIComponent(id);
export const getAdminEventDays = (bookingRequestId: string) =>
  request<{
    eventDays: EventDay[];
  }>(`/admin/event-days?${new URLSearchParams({ bookingRequestId })}`);
export const createEventDay = (
  bookingRequestId: string,
  body: EventDaySchedule,
) =>
  request<{
    eventDay: EventDay;
  }>("/admin/event-days", { bookingRequestId, ...body });
export const applyResponseDeadlines = (body: {
  bookingRequestId: string;
  daysBefore: ResponseDeadlineDays;
  expectedUpdatedAt: string;
}) =>
  request<{ eventDays: EventDay[] }>(
    "/admin/event-days/apply-response-deadlines",
    body,
  );
export type StaffEventDayQuery = PaginationQuery & {
  search?: string;
  filter?: "all" | "open" | "responded";
  date?: string;
};
function queryString(query: StaffEventDayQuery = {}) {
  const params = new URLSearchParams();
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.filter) params.set("filter", query.filter);
  if (query.date) params.set("date", query.date);
  return params.toString();
}
export const getEventDayStaff = (id: string, query: PaginationQuery = {}) =>
  request<PageInfo & { staff: EventDayStaffRow[] }>(
    `/admin/event-days/${path(id)}/staff?${queryString(query)}`,
  );
export const getStaffEventCalendar = (
  month: string,
  query: Pick<StaffEventDayQuery, "search" | "filter"> = {},
) =>
  request<{ counts: { day: string; count: number }[] }>(
    `/staff/event-days/calendar?${queryString(query)}&month=${encodeURIComponent(month)}`,
  );
export const getStaffEventDay = (id: string) =>
  request<{ eventDay: EventDay }>(`/staff/event-days/${path(id)}`);
export const getStaffEventDays = (query: StaffEventDayQuery = {}) =>
  request<
    {
      eventDays: EventDay[];
    } & PageInfo
  >(`/staff/event-days?${queryString(query)}`);
export const getStaffAssignments = (query: StaffEventDayQuery = {}) =>
  request<
    {
      eventDays: EventDay[];
    } & PageInfo
  >(`/staff/assignments?${queryString(query)}`);
export const respondToEventDay = (
  id: string,
  response: "available" | "unavailable",
) =>
  request<{
    eventDay: EventDay;
  }>(
    `/staff/event-days/${path(id)}/availability`,
    { response },
    undefined,
    "PUT",
  );
export const updateStaffing = (
  id: string,
  staffingStatus: "open" | "closed",
  daysBefore?: ResponseDeadlineDays,
) =>
  request<{
    eventDay: EventDay;
  }>(
    `/admin/event-days/${path(id)}/staffing`,
    {
      staffingStatus,
      ...(daysBefore !== undefined ? { daysBefore } : {}),
    },
    undefined,
    "PATCH",
  );
export const setAssignment = (
  id: string,
  staffId: string,
  role: "coordinator" | "helper",
  status: "confirmed" | "cancelled",
) =>
  request<{
    eventDay: EventDay;
  }>(
    `/admin/event-days/${path(id)}/assignments/${path(staffId)}`,
    { role, status },
    undefined,
    "PUT",
  );
export const cancelEventDay = (id: string) =>
  request<{
    eventDay: EventDay;
  }>(`/admin/event-days/${path(id)}/cancel`, {});
export const moveEventDay = (id: string, body: EventDaySchedule) =>
  request<{
    eventDay: EventDay;
  }>(`/admin/event-days/${path(id)}/move`, body);
