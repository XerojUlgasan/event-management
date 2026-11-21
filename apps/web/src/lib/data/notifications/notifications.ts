import { notificationPageSchema } from "@event-management/contracts/notifications";
import { request } from "../../http/request";

export const getNotifications = async (cursor?: string) =>
  notificationPageSchema.parse(
    await request<unknown>(
      `/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  );

export const markNotificationRead = (id: string) =>
  request<void>(`/notifications/${encodeURIComponent(id)}/read`, {});

export const getNotificationRealtimeToken = () =>
  request<{ token: string; expiresAt: string }>("/auth/realtime-token", {
    scope: "notifications",
  });
