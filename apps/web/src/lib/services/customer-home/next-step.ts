import {
  getMyBookingRequest,
  getMyBookingRequests,
  type BookingRequest,
} from "../../data/booking-requests/requests";
import {
  getMyConversations,
  getMyLatestBookingDraft,
} from "../../data/messages/conversations";
import { getNotifications } from "../../data/notifications/notifications";
import { getQuotation } from "../../data/quotations/quotations";
import { ApiError } from "../../http/request";
import {
  customerBookingRequestPath,
  customerConversationPath,
} from "../../navigation/workspace-navigation";

export type CustomerHomeStep = {
  title: string;
  description: string;
  eventType?: string | null;
  requestedDate?: string | null;
  hasMultipleDates?: boolean;
  action:
    | { kind: "start"; label: string }
    | { kind: "navigate"; label: string; path: string }
    | {
        kind: "quotation";
        label: string;
        path: string;
        notificationId: string;
      };
};

const isOpenRequest = ({ status }: BookingRequest) =>
  status !== "declined" && status !== "cancelled" && status !== "finished";

const bookingContext = (booking: BookingRequest) => ({
  eventType: booking.eventType,
  requestedDate: booking.preferredDate,
  hasMultipleDates: (booking.requestedDays?.length ?? 0) > 1,
});

async function latestOpenRequest() {
  let page = await getMyBookingRequests();
  const hasHistory = page.bookingRequests.length > 0;

  for (;;) {
    const booking = page.bookingRequests.find(isOpenRequest);

    if (booking || !page.nextCursor) return { booking, hasHistory };

    page = await getMyBookingRequests(page.nextCursor);
  }
}

async function unreadQuotation(
  latestBooking: BookingRequest,
): Promise<CustomerHomeStep | undefined> {
  let page = await getNotifications();
  let remaining = page.unreadCount;

  while (remaining > 0) {
    for (const notification of page.notifications) {
      if (notification.readAt) continue;

      remaining--;

      if (notification.type !== "quotation_sent") continue;

      const { quotationId, conversationId, version } = notification.payload;

      try {
        const { quotation } = await getQuotation(quotationId);

        // The API keeps superseded versions readable as history.
        if (
          quotation.status !== "sent" ||
          !quotation.sentAt ||
          quotation.version !== version
        )
          continue;

        const booking =
          quotation.bookingRequestId === latestBooking.id
            ? latestBooking
            : (await getMyBookingRequest(quotation.bookingRequestId))
                .bookingRequest;

        if (!isOpenRequest(booking)) continue;

        return {
          ...bookingContext(booking),
          title: "Your quotation is ready to review",
          description:
            "See the pricing and details the team sent for your request.",
          action: {
            kind: "quotation",
            label: "View quotation",
            path: customerConversationPath(conversationId, quotationId),
            notificationId: notification.id,
          },
        };
      } catch (cause) {
        if (!(cause instanceof ApiError && cause.status === 404)) throw cause;
      }
    }

    if (!page.nextCursor || remaining <= 0) return;

    page = await getNotifications(page.nextCursor);
  }
}

export async function loadCustomerHomeStep(): Promise<CustomerHomeStep> {
  const { booking, hasHistory } = await latestOpenRequest();

  if (booking?.status === "needs_details") {
    const { conversations } = await getMyConversations(
      undefined,
      booking.reference,
    );

    const linked = conversations.find(
      (item) => item.bookingRequestId === booking.id,
    );

    return {
      ...bookingContext(booking),
      title: "We need a few more details",
      description: linked
        ? "Open your conversation to see what the team needs for this request."
        : "Open your request to check its status and details.",
      action: {
        kind: "navigate",
        label: linked ? "Open conversation" : "View request",
        path: linked
          ? customerConversationPath(linked.id)
          : customerBookingRequestPath(booking.id),
      },
    };
  }

  if (booking) {
    const quotation = await unreadQuotation(booking);

    if (quotation) return quotation;
  }

  const draft = await getMyLatestBookingDraft();

  if (draft)
    return {
      eventType: draft.eventType,
      title: "Continue planning your event",
      description: "Pick up where you left off in your conversation with AMAC.",
      action: {
        kind: "navigate",
        label: "Continue conversation",
        path: customerConversationPath(draft.conversationId),
      },
    };

  if (booking)
    return {
      ...bookingContext(booking),
      title:
        booking.status === "accepted"
          ? "Your request is being processed"
          : "We’re reviewing your request",
      description:
        "See the details you shared and the latest status of your request.",
      action: {
        kind: "navigate",
        label: "View request",
        path: customerBookingRequestPath(booking.id),
      },
    };

  if (hasHistory)
    return {
      title: "Your past requests are in My events",
      description:
        "Open My events to see the status and details of your closed requests.",
      action: {
        kind: "navigate",
        label: "View past requests",
        path: "/app/events",
      },
    };

  return {
    title: "Tell us what you’re planning",
    description:
      "Share the occasion, a date you have in mind, or a rough guest count. It’s okay if you’re still deciding.",
    action: { kind: "start", label: "Start planning" },
  };
}
