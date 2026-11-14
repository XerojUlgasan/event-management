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
  replacementEventDayId: string | null;
};

export type EventDaySchedule = {
  day: string;
  startsAt: string;
  endsAt: string;
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

export const cancelEventDay = (id: string) =>
  request<{
    eventDay: EventDay;
  }>(`/admin/event-days/${path(id)}/cancel`, {});

export const moveEventDay = (id: string, body: EventDaySchedule) =>
  request<{
    eventDay: EventDay;
  }>(`/admin/event-days/${path(id)}/move`, body);
