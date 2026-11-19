import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  hasLocalReplyPending,
  hasObservedReply,
  reconcilePendingReplies,
} from "../../src/lib/services/messages/pending-replies.ts";
import type {
  ChatConversation,
  ChatMessage,
} from "../../src/lib/data/messages/conversations.ts";

const conversation = {
  id: "one",
  aiVersion: 2,
  aiEnabled: true,
  status: "active",
} as ChatConversation;

const message = (
  id: string,
  senderRole: ChatMessage["senderRole"],
  replyToMessageId: string | null = null,
) => ({ id, senderRole, replyToMessageId }) as ChatMessage;

const pending = { sent: { conversationId: "one", aiVersion: 2 } };

test("delivery acknowledgement does not settle a pending reply; its linked reply does", () => {
  assert.equal(hasLocalReplyPending(pending, conversation), true);
  const settled = reconcilePendingReplies(pending, conversation, [
    message("reply", "assistant", "sent"),
  ]);
  assert.deepEqual(settled, {});
  assert.equal(hasLocalReplyPending(settled, conversation), false);
});

test("AI version changes invalidate earlier turns and other conversations stay isolated", () => {
  assert.deepEqual(
    reconcilePendingReplies(pending, { ...conversation, aiVersion: 4 }, []),
    {},
  );
  assert.equal(
    hasLocalReplyPending(pending, { ...conversation, aiEnabled: false }),
    false,
  );
  assert.equal(
    hasLocalReplyPending(pending, { ...conversation, id: "two" }),
    false,
  );
});

test("unrelated replies cannot settle pending requests; matching replies settle only their own", () => {
  const overlapping = {
    ...pending,
    later: { conversationId: "one", aiVersion: 2 },
  };
  const unrelated = [
    message("other", "assistant", "another"),
    message("unlinked", "assistant"),
  ];
  assert.deepEqual(
    reconcilePendingReplies(overlapping, conversation, unrelated),
    overlapping,
  );
  const one = reconcilePendingReplies(overlapping, conversation, [
    ...unrelated,
    message("later-reply", "assistant", "later"),
  ]);
  assert.deepEqual(one, pending);
  assert.equal(hasLocalReplyPending(one, conversation), true);
  const all = reconcilePendingReplies(one, conversation, [
    message("first-reply", "assistant", "sent"),
  ]);
  assert.deepEqual(all, {});
  assert.equal(hasLocalReplyPending(all, conversation), false);
});

test("a linked reply observed while a job is still replying prevents a delayed acknowledgement bridge", () => {
  const source = {
    ...message("sent", "customer"),
    processing: { status: "replying", replyPending: false },
  } as ChatMessage;
  const unrelated = message("other", "assistant", "different");
  const reply = message("reply", "assistant", "sent");
  assert.equal(hasObservedReply([source, unrelated], "sent"), false);
  assert.equal(hasObservedReply([source, unrelated, reply], "sent"), true);
});

test("closing a conversation settles local pending replies", () => {
  const closed = { ...conversation, status: "closed" as const };
  assert.equal(hasLocalReplyPending(pending, closed), false);
  assert.deepEqual(reconcilePendingReplies(pending, closed, []), {});
});
