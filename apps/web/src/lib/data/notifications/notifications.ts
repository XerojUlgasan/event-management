import { notificationPageSchema } from "@event-management/contracts/notifications";
import { request } from "../../http/request";

export async function getNotifications(cursor?: string) {
  const query = new URLSearchParams({ includeBookingDetails: "1" });

  if (cursor) query.set("cursor", cursor);

  return notificationPageSchema.parse(
    await request<unknown>(`/notifications?${query}`),
  );
}

export const markNotificationRead = (id: string) =>
  request<void>(`/notifications/${encodeURIComponent(id)}/read`, {});

export const getNotificationRealtimeToken = () =>
  request<{ token: string; expiresAt: string }>("/auth/realtime-token", {
    scope: "notifications",
  });
