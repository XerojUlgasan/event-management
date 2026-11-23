import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let server,
  cacheDir,
  BookingIntake,
  displayedReviewForReply,
  reviewForComposition,
  reviewForSend,
  retryableSubmissionError,
  reconcileSubmissionRetries,
  messagePayload,
  applyRealtimeMessage;

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "clemora-booking-review-"));
  server = await createServer({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    cacheDir,
    BookingIntake,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
    esbuild: { jsx: "automatic" },
    resolve: {
      noExternal: ["@uiw/react-markdown-preview"],
      external: ["@babel/runtime"],
    },
    logLevel: "silent",
  });
  ({ BookingIntake } = await server.ssrLoadModule(
    "/src/components/booking-requests/BookingIntake.tsx",
  ));
  ({
    displayedReviewForReply,
    reviewForComposition,
    reviewForSend,
    retryableSubmissionError,
    reconcileSubmissionRetries,
  } = await server.ssrLoadModule(
    "/src/lib/services/messages/booking-review.ts",
  ));
  ({ messagePayload } = await server.ssrLoadModule(
    "/src/lib/data/messages/conversations.ts",
  ));
  ({ applyRealtimeMessage } = await server.ssrLoadModule(
    "/src/lib/services/messages/realtime-event.ts",
  ));
});

test("composition keeps its original review when another message arrives", () => {
  const r1 = { id: "review-1", senderRole: "assistant" };
  const r2 = { id: "review-2", senderRole: "assistant" };
  let pin = reviewForComposition("", "Y", undefined, [r1]);
  assert.equal(pin, "review-1");
  pin = reviewForComposition("Y", "Yes, submit", pin, [r1, r2]);
  assert.equal(pin, "review-1");
  assert.equal(reviewForSend(pin, false), "review-1");
  assert.equal(reviewForComposition("Yes, submit", "", pin, [r2]), undefined);
  const next = reviewForComposition("", "Yes, submit", undefined, [r2]);
  assert.equal(reviewForSend(next, false), "review-2");
  assert.equal(reviewForSend(next, true), undefined);
  const noReview = reviewForComposition("", "Yes, submit", undefined, []);
  assert.equal(noReview, null);
  assert.equal(reviewForSend(noReview, false), undefined);
});

test("realtime delivery preserves the ordinary assistant message in the visible thread", () => {
  const conversationId = "f7fc7bf0-951f-42ee-98eb-90a0f4f297e0";
  const message = {
    id: "d860a6c4-c695-474e-9bae-d1ca3fdb4436",
    body: "Please review.",
    images: [],
    processing: null,
    quotationId: null,
    replyToMessageId: null,
    senderId: null,
    senderRole: "assistant",
    senderName: "AMAC AI",
    createdAt: "2026-11-21T00:00:00.000Z",
    readAt: null,
  };
  const thread = {
    conversation: {
      id: conversationId,
      updatedAt: message.createdAt,
      lastMessage: null,
    },
    messages: [],
    nextCursor: null,
  };
  const result = applyRealtimeMessage(thread, conversationId, {
    type: "conversation_message_added",
    delivery: "inline",
    conversationId,
    message,
  });
  assert.equal(result.thread.messages[0].body, message.body);
  assert.equal(
    displayedReviewForReply(result.thread.messages, false),
    message.id,
  );
});
after(async () => {
  await server?.close();

  if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
});

test("only a displayed latest assistant message is attached to text and payload retains its ID", () => {
  const shown = {
    id: "review-1",
    senderRole: "assistant",
  };
  assert.equal(displayedReviewForReply([shown], false), "review-1");
  assert.equal(displayedReviewForReply([shown], true), undefined);
  assert.equal(
    displayedReviewForReply(
      [shown, { id: "later", senderRole: "customer" }],
      false,
    ),
    undefined,
  );
  assert.equal(displayedReviewForReply([], false), undefined);
  assert.deepEqual(
    messagePayload("Yes, submit", [], {
      conversationId: "conversation-1",
      requestId: "request-1",
      reviewMessageId: "review-1",
    }),
    {
      body: "Yes, submit",
      conversationId: "conversation-1",
      requestId: "request-1",
      reviewMessageId: "review-1",
    },
  );
});

test("booking details show requested services and budget", () => {
  const html = renderToStaticMarkup(
    createElement(BookingIntake, {
      requestedServices: [
        {
          serviceId: null,
          name: "Bilingual host",
          hours: 3,
          notes: "If possible",
          included: false,
          updatedAt: null,
        },
      ],
      budget: "PHP 50,000",
    }),
  );

  for (const value of [
    "Bilingual host",
    "3 hours",
    "If possible",
    "PHP 50,000",
  ])
    assert.ok(html.includes(value));

  assert.equal(
    renderToStaticMarkup(
      createElement(BookingIntake, { requestedServices: [], budget: null }),
    ),
    "",
  );
});

test("saved replies in any language remain retryable with their original payload until the assistant replies", () => {
  const message = {
    id: "send-1",
    senderRole: "customer",
    body: "Yes, submit",
    reviewMessageId: "review-1",
    pendingFiles: [],
  };
  assert.equal(retryableSubmissionError(message, "Temporary failure"), true);
  assert.equal(
    retryableSubmissionError(
      { ...message, body: "Hello" },
      "Temporary failure",
    ),
    true,
  );
  assert.equal(
    retryableSubmissionError(
      { ...message, reviewMessageId: undefined },
      "Temporary failure",
    ),
    false,
  );
  assert.equal(retryableSubmissionError(message, null), false);
  const outbox = { [message.id]: { message, failed: false } };
  // Polling can see the saved customer message before the send returns.
  // Its server copy has no pin. Retain the original local reply context.
  const observed = { ...message, reviewMessageId: undefined };
  assert.deepEqual(reconcileSubmissionRetries(outbox, [observed]), outbox);
  const failed = { [message.id]: { message, failed: true } };
  assert.deepEqual(reconcileSubmissionRetries(failed, [observed]), failed);
  assert.deepEqual(reconcileSubmissionRetries(outbox, [message]), outbox);
  assert.deepEqual(
    reconcileSubmissionRetries(outbox, [
      { id: "reply", senderRole: "assistant", replyToMessageId: message.id },
    ]),
    {},
  );
});
