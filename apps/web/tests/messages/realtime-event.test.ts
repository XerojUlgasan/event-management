import assert from "node:assert/strict";
import test from "node:test";
import type {
  ChatMessage,
  ChatThread,
} from "../../src/lib/data/messages/conversations";
import {
  applyRealtimeMessage,
  isCurrentSubscription,
  isIncomingMessage,
  isPermanentTokenFailure,
  shouldRefreshAiMetadata,
  realtimeRefreshDelay,
} from "../../src/lib/services/messages/realtime-event";
import {
  addSentMessages,
  mergePolledThread,
} from "../../src/lib/services/messages/merge-thread";

const conversationId = "10000000-0000-4000-8000-000000000000";

const message = (n: number): ChatMessage => ({
  id: `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  body: `message ${n}`,
  images: [],
  processing: null,
  quotationId: null,
  replyToMessageId: null,
  senderId: null,
  senderRole: "assistant" as const,
  senderName: "Assistant",
  createdAt: `2026-01-01T00:00:0${n}.000Z`,
  readAt: null,
});

const event = (n: number) => ({
  type: "conversation_message_added",
  delivery: "inline",
  conversationId,
  message: message(n),
});

const thread = (
  messages: ChatMessage[],
  nextCursor: string | null = null,
): ChatThread => ({
  conversation: {
    id: conversationId,
    lastMessage: messages.at(-1) ?? null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as ChatThread["conversation"],
  messages,
  nextCursor,
});

test("only valid events for the selected conversation are applied", () => {
  const current = thread([message(1)]);
  assert.equal(
    applyRealtimeMessage(current, conversationId, {
      ...event(2),
      conversationId: message(1).id,
    }).thread,
    current,
  );
  assert.equal(
    applyRealtimeMessage(current, conversationId, {
      ...event(2),
      message: { ...message(2), body: 3 },
    }).thread,
    current,
  );
  assert.deepEqual(
    applyRealtimeMessage(
      current,
      conversationId,
      event(2),
    ).thread?.messages.map((m) => m.id),
    [message(1).id, message(2).id],
  );
});

test("inline arrival survives an older poll and a later send response is deduplicated", () => {
  const current = applyRealtimeMessage(
    thread([message(1)]),
    conversationId,
    event(2),
  ).thread!;
  const result = mergePolledThread(
    current,
    thread([message(1)]),
    new Set([message(2).id]),
  ).thread;
  assert.deepEqual(
    addSentMessages(result, [message(2)]).messages.map((m) => m.id),
    [message(1).id, message(2).id],
  );
});

test("poll replaces the inline message with its read receipt", () => {
  const current = applyRealtimeMessage(
    thread([message(1)]),
    conversationId,
    event(2),
  ).thread!;
  const readMessage = { ...message(2), readAt: "2026-01-01T00:00:03.000Z" };
  const result = mergePolledThread(
    current,
    thread([message(1), readMessage]),
    new Set([message(2).id]),
  ).thread;
  assert.equal(result.messages[1].readAt, readMessage.readAt);
});

test("stale subscriptions cannot dispatch to a switched or hidden thread", () => {
  assert.equal(
    isCurrentSubscription(conversationId, false, {
      id: conversationId,
      enabled: true,
      admin: false,
    }),
    true,
  );
  assert.equal(
    isCurrentSubscription(conversationId, false, {
      id: message(1).id,
      enabled: true,
      admin: false,
    }),
    false,
  );
  assert.equal(
    isCurrentSubscription(conversationId, false, {
      id: conversationId,
      enabled: false,
      admin: false,
    }),
    false,
  );
  assert.equal(
    isCurrentSubscription(conversationId, false, {
      id: conversationId,
      enabled: true,
      admin: true,
    }),
    false,
  );
});

test("read receipts match existing incoming sender rules", () => {
  assert.equal(isIncomingMessage(true, message(1)), false);
  assert.equal(
    isIncomingMessage(true, { ...message(1), senderRole: "customer" }),
    true,
  );
  assert.equal(isIncomingMessage(false, message(1)), true);
  assert.equal(
    isIncomingMessage(false, { ...message(1), senderRole: "customer" }),
    false,
  );
});

test("authorization and missing conversation token failures do not retry", () => {
  for (const status of [401, 403, 404])
    assert.equal(isPermanentTokenFailure(status), true);

  for (const status of [429, 500])
    assert.equal(isPermanentTokenFailure(status), false);
});

test("signed-in polling defers the initial read until the thread is visible", async () => {
  const { startVisiblePolling } =
    await import("../../src/lib/services/messages/use-realtime-thread");
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const listeners = new Map<string, () => void>();

  const fakeDocument = {
    visibilityState: "hidden",
    addEventListener: (name: string, callback: () => void) =>
      listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name),
  };

  const fakeWindow = {
    addEventListener: (name: string, callback: () => void) =>
      listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name),
  };

  Object.assign(globalThis, { document: fakeDocument, window: fakeWindow });

  try {
    let loads = 0;

    const stop = startVisiblePolling(() => loads++, true);

    assert.equal(loads, 0);
    fakeDocument.visibilityState = "visible";
    listeners.get("visibilitychange")?.();
    assert.equal(loads, 1);
    stop();

    const stopClosed = startVisiblePolling(() => loads++, false);

    listeners.get("focus")?.();
    assert.equal(loads, 1);
    stopClosed();
  } finally {
    if (originalDocument === undefined)
      delete (globalThis as { document?: Document }).document;
    else globalThis.document = originalDocument;

    if (originalWindow === undefined)
      delete (globalThis as { window?: Window }).window;
    else globalThis.window = originalWindow;
  }
});

test("only messages that can change AI metadata request a refresh", () => {
  const enabled = { aiEnabled: true, aiReplyPending: false };
  const disabled = { aiEnabled: false, aiReplyPending: false };
  const image = {
    ...message(1),
    senderRole: "customer" as const,
    processing: {
      status: "queued" as const,
      errorCode: null,
      canRetry: false,
      replyPending: true,
    },
  };
  assert.equal(shouldRefreshAiMetadata(enabled, image), true);
  assert.equal(
    shouldRefreshAiMetadata(enabled, { ...message(1), senderRole: "customer" }),
    false,
  );
  assert.equal(shouldRefreshAiMetadata(enabled, message(1)), true);
  assert.equal(
    shouldRefreshAiMetadata(enabled, { ...message(1), senderRole: "admin" }),
    true,
  );
  assert.equal(shouldRefreshAiMetadata(disabled, message(1)), false);
  assert.equal(
    shouldRefreshAiMetadata(
      { aiEnabled: false, aiReplyPending: true },
      message(1),
    ),
    true,
  );
});

test("admin takeover refreshes a paused pending handoff", () => {
  const pendingHandoff = {
    aiEnabled: false,
    aiReplyPending: false,
    aiHandoff: {
      pending: true,
      reason: "customer_requested" as const,
      summary: "Please assist",
    },
  };
  assert.equal(
    shouldRefreshAiMetadata(pendingHandoff, {
      ...message(1),
      senderRole: "admin",
    }),
    true,
  );
  assert.equal(
    shouldRefreshAiMetadata(pendingHandoff, {
      ...message(1),
      senderRole: "customer",
    }),
    false,
  );
});

test("cookie-limited realtime tokens do not reconnect every second", () => {
  assert.equal(realtimeRefreshDelay(60_000, 0), 30_000);
  assert.equal(realtimeRefreshDelay(60_000, 30_000, 60_000), 25_000);
  assert.equal(realtimeRefreshDelay(60_000, 55_000, 60_000), null);
  assert.equal(realtimeRefreshDelay(600_000, 0), 540_000);
});

test("Supabase transport ID is ignored while other unexpected fields remain invalid", () => {
  const current = thread([message(1)]);
  const providerId = "30000000-0000-4000-8000-000000000000";
  const withId = { ...event(2), id: providerId };
  assert.equal(
    applyRealtimeMessage(current, conversationId, withId).message?.id,
    message(2).id,
  );
  assert.equal(
    applyRealtimeMessage(current, conversationId, {
      ...withId,
      unexpected: true,
    }).message,
    null,
  );
  assert.equal(
    applyRealtimeMessage(current, conversationId, {
      ...withId,
      message: { ...message(2), body: 3 },
    }).message,
    null,
  );
});
