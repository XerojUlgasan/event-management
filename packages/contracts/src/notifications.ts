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
  quotationSent,
  humanReviewRequested,
]);

const notificationFields = {
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
};

export const notificationSchema = z.discriminatedUnion("type", [
  bookingRequestCreated.extend(notificationFields),
  bookingStatusUpdated.extend(notificationFields),
  quotationSent.extend(notificationFields),
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
