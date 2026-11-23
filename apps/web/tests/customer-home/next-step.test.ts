import assert from "node:assert/strict";
import test from "node:test";
import { loadCustomerHomeStep } from "../../src/lib/services/customer-home/next-step.ts";

const uuid = (value: string) =>
  `10000000-0000-4000-8000-${String([...value].reduce((sum, char) => sum + char.charCodeAt(0), 0)).padStart(12, "0")}`;

const booking = (label: string, status: string, reference = label) => ({
  id: uuid(label),
  reference,
  status,
  eventType: "Birthday",
  preferredDate: "2090-04-12",
  requestedDays: [{ date: "2090-04-12" }],
});

const notification = (
  label: string,
  quotationId: string,
  version: number,
  readAt: string | null = null,
) => ({
  id: uuid(label),
  type: "quotation_sent",
  payload: {
    conversationId: uuid("conversation-1"),
    quotationId: uuid(quotationId),
    version,
  },
  createdAt: "2090-01-01T00:00:00.000Z",
  readAt,
});

const quotation = (
  label: string,
  status: "sent" | "superseded",
  version: number,
  bookingRequestId = "booking-1",
) => ({
  id: uuid(label),
  bookingRequestId: uuid(bookingRequestId),
  version,
  status,
  sentAt: "2090-01-01T00:00:00.000Z",
});

function installApi(
  t: test.TestContext,
  routes: Record<string, unknown | ((url: URL) => unknown)>,
) {
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    paths.push(`${url.pathname}${url.search}`);
    const result = routes[url.pathname + url.search] ?? routes[url.pathname];

    if (result === undefined)
      return new Response(
        JSON.stringify({ error: `Unexpected ${url.pathname}${url.search}` }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );

    const body = typeof result === "function" ? result(url) : result;

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  return paths;
}

const emptyPage = { bookingRequests: [], nextCursor: null };

const emptyNotifications = {
  notifications: [],
  unreadCount: 0,
  nextCursor: null,
};

test("empty account gets the start action", async (t) => {
  const paths = installApi(t, {
    "/v1/booking-requests/mine": emptyPage,
    "/v1/messages/conversations": { latestBookingDraft: null },
  });

  assert.deepEqual(await loadCustomerHomeStep(), {
    title: "Tell us what you’re planning",
    description:
      "Share the occasion, a date you have in mind, or a rough guest count. It’s okay if you’re still deciding.",
    action: { kind: "start", label: "Start planning" },
  });
  assert.deepEqual(paths, [
    "/v1/booking-requests/mine",
    "/v1/messages/conversations?includeLatestBookingDraft=1&limit=1",
  ]);
});

test("owned returned draft links to its exact conversation", async (t) => {
  installApi(t, {
    "/v1/booking-requests/mine": emptyPage,
    "/v1/messages/conversations": {
      latestBookingDraft: {
        conversationId: "draft-thread",
        eventType: "Wedding",
      },
    },
  });

  assert.deepEqual(await loadCustomerHomeStep(), {
    eventType: "Wedding",
    title: "Continue planning your event",
    description: "Pick up where you left off in your conversation with AMAC.",
    action: {
      kind: "navigate",
      label: "Continue conversation",
      path: "/app/messages?conversation=draft-thread",
    },
  });
});

test("latest open needs-details request takes priority and links its own conversation", async (t) => {
  const paths = installApi(t, {
    "/v1/booking-requests/mine": {
      bookingRequests: [
        booking("closed", "cancelled"),
        booking("needs", "needs_details", "REQ-NEEDS"),
      ],
      nextCursor: null,
    },
    "/v1/notifications": {
      notifications: [
        notification("unread-quote", "quote-for-other-request", 1),
      ],
      unreadCount: 1,
      nextCursor: null,
    },
    "/v1/messages/conversations?reference=REQ-NEEDS": {
      conversations: [
        { id: uuid("unrelated"), bookingRequestId: uuid("other-booking") },
        { id: uuid("needs-thread"), bookingRequestId: uuid("needs") },
      ],
      nextCursor: null,
    },
  });

  assert.deepEqual(await loadCustomerHomeStep(), {
    eventType: "Birthday",
    requestedDate: "2090-04-12",
    hasMultipleDates: false,
    title: "We need a few more details",
    description:
      "Open your conversation to see what the team needs for this request.",
    action: {
      kind: "navigate",
      label: "Open conversation",
      path: `/app/messages?conversation=${uuid("needs-thread")}`,
    },
  });
  assert.deepEqual(paths, [
    "/v1/booking-requests/mine",
    "/v1/messages/conversations?reference=REQ-NEEDS",
  ]);
});

test("unread quotation links to the matching sent version and exact quote", async (t) => {
  const paths = installApi(t, {
    "/v1/booking-requests/mine": {
      bookingRequests: [booking("booking-1", "under_review")],
      nextCursor: null,
    },
    "/v1/notifications": {
      notifications: [notification("notice-1", "quote-1", 3)],
      unreadCount: 1,
      nextCursor: null,
    },
    [`/v1/quotations/${uuid("quote-1")}`]: {
      quotation: quotation("quote-1", "sent", 3),
    },
  });

  const result = await loadCustomerHomeStep();
  assert.deepEqual(result.action, {
    kind: "quotation",
    label: "View quotation",
    path: `/app/messages?conversation=${uuid("conversation-1")}&quotation=${uuid("quote-1")}`,
    notificationId: uuid("notice-1"),
  });
  assert.ok(paths.includes(`/v1/quotations/${uuid("quote-1")}`));
});

test("seen, wrong-version, superseded and closed-request quotation alerts fall back", async (t) => {
  const paths = installApi(t, {
    "/v1/booking-requests/mine": {
      bookingRequests: [booking("booking-1", "under_review")],
      nextCursor: null,
    },
    "/v1/notifications": {
      notifications: [
        notification("seen", "quote-seen", 1, "2090-01-02T00:00:00.000Z"),
        notification("wrong-version", "quote-wrong", 4),
        notification("replaced", "quote-old", 2),
        notification("closed-booking", "quote-closed", 1),
      ],
      unreadCount: 3,
      nextCursor: null,
    },
    [`/v1/quotations/${uuid("quote-wrong")}`]: {
      quotation: quotation("quote-wrong", "sent", 3),
    },
    [`/v1/quotations/${uuid("quote-old")}`]: {
      quotation: quotation("quote-old", "superseded", 2),
    },
    [`/v1/quotations/${uuid("quote-closed")}`]: {
      quotation: quotation("quote-closed", "sent", 1, "booking-closed"),
    },
    [`/v1/booking-requests/${uuid("booking-closed")}`]: {
      bookingRequest: booking("booking-closed", "cancelled"),
    },
    "/v1/messages/conversations": { latestBookingDraft: null },
  });

  const result = await loadCustomerHomeStep();
  assert.equal(result.title, "We’re reviewing your request");
  assert.deepEqual(result.action, {
    kind: "navigate",
    label: "View request",
    path: `/app/events?bookingRequest=${uuid("booking-1")}`,
  });
  assert.ok(!paths.includes(`/v1/quotations/${uuid("quote-seen")}`));
  assert.ok(paths.includes(`/v1/quotations/${uuid("quote-wrong")}`));
  assert.ok(paths.includes(`/v1/quotations/${uuid("quote-old")}`));
  assert.ok(paths.includes(`/v1/quotations/${uuid("quote-closed")}`));
});

test("closed history has no current request", async (t) => {
  const paths = installApi(t, {
    "/v1/booking-requests/mine": {
      bookingRequests: [booking("closed", "declined")],
      nextCursor: null,
    },
    "/v1/messages/conversations": { latestBookingDraft: null },
  });

  const result = await loadCustomerHomeStep();
  assert.equal(result.title, "Your past requests are in My events");
  assert.deepEqual(result.action, {
    kind: "navigate",
    label: "View past requests",
    path: "/app/events",
  });
  assert.ok(
    paths.includes(
      "/v1/messages/conversations?includeLatestBookingDraft=1&limit=1",
    ),
  );
});

test("failed reads reject instead of silently choosing another step", async (t) => {
  installApi(t, {
    "/v1/booking-requests/mine": () => {
      throw new Error("network unavailable");
    },
  });

  await assert.rejects(loadCustomerHomeStep(), /network unavailable/);
});

test("accepted request shows the processing status fallback", async (t) => {
  installApi(t, {
    "/v1/booking-requests/mine": {
      bookingRequests: [booking("booking-accepted", "accepted")],
      nextCursor: null,
    },
    "/v1/notifications": emptyNotifications,
    "/v1/messages/conversations": { latestBookingDraft: null },
  });

  const result = await loadCustomerHomeStep();
  assert.equal(result.title, "Your request is being processed");
  assert.deepEqual(result.action, {
    kind: "navigate",
    label: "View request",
    path: `/app/events?bookingRequest=${uuid("booking-accepted")}`,
  });
});

test("missing latest draft projection rejects", async (t) => {
  installApi(t, {
    "/v1/booking-requests/mine": emptyPage,
    "/v1/messages/conversations": {},
  });

  await assert.rejects(
    loadCustomerHomeStep(),
    /booking draft projection is unavailable/,
  );
});
