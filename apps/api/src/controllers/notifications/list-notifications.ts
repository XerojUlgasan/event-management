import {
  notificationContentSchema,
  notificationPageSchema,
} from "@event-management/contracts/notifications";
import {
  createPage,
  MAX_CURSOR_LENGTH,
} from "@event-management/contracts/pagination";
import { createRoute, z } from "@hono/zod-openapi";
import {
  listNotificationBookingsData,
  listNotificationsData,
} from "../../data/notifications/list-notifications.js";
import type { AppRouteHandler } from "../../types/hono.js";
import {
  encodePageCursor,
  parsePageCursor,
  postgresTimestampSchema,
} from "../../utils/pagination.js";
import { errors, json } from "./http.js";

const PAGE_SIZE = 20;

const cursorPosition = z.strictObject({
  createdAt: postgresTimestampSchema,
  id: z.uuid(),
});

export const listNotificationsRoute = createRoute({
  method: "get",
  path: "/notifications",
  tags: ["Notifications"],
  summary: "List notifications for the signed-in account",
  request: {
    query: z.object({
      cursor: z.string().min(1).max(MAX_CURSOR_LENGTH).optional(),
      includeBookingDetails: z.literal("1").optional(),
    }),
  },
  responses: {
    200: {
      content: json(notificationPageSchema),
      description: "Notification page and unread count",
    },
    400: errors[400],
    401: errors[401],
  },
});

export const listNotificationsRouteHandler: AppRouteHandler<
  typeof listNotificationsRoute
> = async (c) => {
  const viewer = c.get("session").user;
  const db = c.get("db");
  const scope = `notifications:${viewer.id}`;
  const query = c.req.valid("query");
  const cursor = parsePageCursor(query.cursor, cursorPosition, scope);
  const { rows, unread_count } = await listNotificationsData(
    db,
    viewer.id,
    PAGE_SIZE,
    cursor,
  );

  const page = createPage(rows, PAGE_SIZE, ({ cursor_created_at, id }) =>
    encodePageCursor(scope, { createdAt: cursor_created_at, id }),
  );

  const notifications = page.items.map(
    ({ id, type, payload, cursor_created_at, read_at }) => ({
      ...notificationContentSchema.parse({ type, payload }),
      id,
      createdAt: cursor_created_at,
      readAt: read_at,
    }),
  );

  const bookingIdFor = (item: (typeof notifications)[number]) => {
    if (
      query.includeBookingDetails &&
      (item.type === "booking_status_updated" ||
        (item.type === "booking_request_created" && viewer.role === "admin"))
    )
      return item.payload.bookingRequestId.toLowerCase();
  };

  const items = notifications.map((notification) => ({
    notification,
    bookingId: bookingIdFor(notification),
  }));

  const bookingIds = [
    ...new Set(items.flatMap(({ bookingId }) => (bookingId ? [bookingId] : []))),
  ];

  const bookings = new Map(
    (await listNotificationBookingsData(db, bookingIds, viewer)).map(
      ({ id, event_type, preferred_date }) => [
        id,
        { eventType: event_type, preferredDate: preferred_date },
      ],
    ),
  );

  return c.json(
    {
      notifications: items.map(({ notification, bookingId }) => {
        const booking = bookingId ? bookings.get(bookingId) : undefined;

        return booking ? { ...notification, booking } : notification;
      }),
      unreadCount: Number(unread_count),
      nextCursor: page.nextCursor,
    },
    200,
  );
};
