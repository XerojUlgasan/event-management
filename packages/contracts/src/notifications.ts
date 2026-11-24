import { z } from "zod";
import { bookingStatusSchema } from "./booking-requests.js";

const bookingPayload = {
  bookingRequestId: z.uuid(),
  bookingReference: z.string().min(1),
};

const bookingRequestCreated = z.strictObject({
  type: z.literal("booking_request_created"),
  payload: z.strictObject(bookingPayload),
});

const bookingStatusUpdated = z.strictObject({
  type: z.literal("booking_status_updated"),
  payload: z.strictObject({
    ...bookingPayload,
    status: bookingStatusSchema,
  }),
});

const eventReadyToFinish = z.strictObject({
  type: z.literal("event_ready_to_finish"),
  payload: z.strictObject(bookingPayload),
});

const eventFinished = z.strictObject({
  type: z.literal("event_finished"),
  payload: z.strictObject(bookingPayload),
});

const quotationSent = z.strictObject({
  type: z.literal("quotation_sent"),
  payload: z.strictObject({
    conversationId: z.uuid(),
    quotationId: z.uuid(),
    version: z.int().positive(),
  }),
});

const humanReviewRequested = z.strictObject({
  type: z.literal("human_review_requested"),
  payload: z.strictObject({ conversationId: z.uuid() }),
});

export const notificationContentSchema = z.discriminatedUnion("type", [
  bookingRequestCreated,
  bookingStatusUpdated,
  eventReadyToFinish,
  eventFinished,
  quotationSent,
  humanReviewRequested,
]);

const notificationFields = {
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
};

const bookingNotificationFields = {
  ...notificationFields,
  booking: z
    .strictObject({
      eventType: z.string(),
      preferredDate: z.iso.date().nullable(),
    })
    .optional(),
};

export const notificationSchema = z.discriminatedUnion("type", [
  bookingRequestCreated.extend(bookingNotificationFields),
  bookingStatusUpdated.extend(bookingNotificationFields),
  eventReadyToFinish.extend(bookingNotificationFields),
  eventFinished.extend(bookingNotificationFields),
  quotationSent.extend(bookingNotificationFields),
  humanReviewRequested.extend(notificationFields),
]);

export const notificationPageSchema = z.strictObject({
  notifications: z.array(notificationSchema),
  unreadCount: z.int().nonnegative(),
  nextCursor: z.string().nullable(),
});

export const NOTIFICATIONS_CHANGED = "notifications_changed";

export const notificationsChangedSchema = z.strictObject({
  type: z.literal(NOTIFICATIONS_CHANGED),
});

export type NotificationContent = z.infer<typeof notificationContentSchema>;

export type Notification = z.infer<typeof notificationSchema>;

export type NotificationPage = z.infer<typeof notificationPageSchema>;
