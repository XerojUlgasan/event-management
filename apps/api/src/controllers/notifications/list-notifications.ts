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
  listNotificationQuotationsData,
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
      includeQuotationDetails: z.literal("1").optional(),
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

  const items = page.items.map(
    ({ id, type, payload, source_event_id, cursor_created_at, read_at }) => ({
      notification: {
        ...notificationContentSchema.parse({ type, payload }),
        id,
        createdAt: cursor_created_at,
        readAt: read_at,
      },
      sourceEventId: source_event_id,
    }),
  );

  const bookingIds = new Set<string>();
  const quotationIds = new Set<string>();

  for (const { notification, sourceEventId } of items) {
    if (
      query.includeBookingDetails &&
      (notification.type === "booking_status_updated" ||
        (notification.type === "booking_request_created" &&
          viewer.role === "admin"))
    )
      bookingIds.add(notification.payload.bookingRequestId.toLowerCase());

    if (
      query.includeQuotationDetails &&
      notification.type === "quotation_sent" &&
      notification.payload.quotationId.toLowerCase() === sourceEventId
    )
      quotationIds.add(sourceEventId);
  }

  const [bookingRows, quotationRows] = await Promise.all([
    listNotificationBookingsData(db, [...bookingIds], viewer),
    listNotificationQuotationsData(db, [...quotationIds], viewer.id),
  ]);

  const bookings = new Map(bookingRows.map((row) => [row.id, row]));

  const quotations = new Map(quotationRows.map((row) => [row.id, row]));

  return c.json(
    {
      notifications: items.map(({ notification, sourceEventId }) => {
        if (notification.type === "human_review_requested") return notification;

        if (notification.type === "quotation_sent") {
          const quotation = quotations.get(sourceEventId);
          const { quotationId, conversationId, version } = notification.payload;

          if (
            !quotation ||
            quotation.id !== quotationId.toLowerCase() ||
            quotation.conversation_id !== conversationId.toLowerCase() ||
            quotation.version !== version
          )
            return notification;

          return {
            ...notification,
            booking: {
              eventType: quotation.event_type,
              preferredDate: quotation.preferred_date,
            },
          };
        }

        if (
          notification.type === "booking_request_created" &&
          viewer.role !== "admin"
        )
          return notification;

        const booking = bookings.get(
          notification.payload.bookingRequestId.toLowerCase(),
        );

        return booking
          ? {
              ...notification,
              booking: {
                eventType: booking.event_type,
                preferredDate: booking.preferred_date,
              },
            }
          : notification;
      }),
      unreadCount: Number(unread_count),
      nextCursor: page.nextCursor,
    },
    200,
  );
};
