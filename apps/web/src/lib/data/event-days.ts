import { request } from "../http";
export type EventDay = {
  id: string;
  bookingRequestId: string;
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
  availabilityDeadline: string | null;
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
export const getStaffEventDays = () =>
  request<{
    eventDays: EventDay[];
  }>("/staff/event-days");
export const getStaffAssignments = () =>
  request<{
    eventDays: EventDay[];
  }>("/staff/assignments");
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
  availabilityDeadline?: string | null,
) =>
  request<{
    eventDay: EventDay;
  }>(
    `/admin/event-days/${path(id)}/staffing`,
    {
      staffingStatus,
      ...(availabilityDeadline !== undefined ? { availabilityDeadline } : {}),
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
