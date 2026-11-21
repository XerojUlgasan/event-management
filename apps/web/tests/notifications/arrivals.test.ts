import assert from "node:assert/strict";
import { test } from "node:test";
import { createArrivalTracker } from "../../src/lib/services/notifications/arrivals.ts";
import type { Notification } from "@event-management/contracts/notifications";

function row(
  id: string,
  createdAt: string,
  readAt: string | null = null,
): Notification {
  return {
    id,
    createdAt,
    readAt,
    type: "human_review_requested",
    payload: { conversationId: "conversation" },
  };
}

test("seeds history, announces only the newest unseen unread first-page row, and never repeats", () => {
  const tracker = createArrivalTracker();
  const older = row("older", "2026-01-01T10:00:00.000Z");
  const initial = row("initial", "2026-01-01T11:00:00.000Z");
  const newer = row("newer", "2026-01-01T12:00:00.000Z");
  const newest = row("newest", "2026-01-01T13:00:00.000Z");

  assert.equal(tracker.observe([initial], true), undefined);
  assert.equal(tracker.observe([older], false), undefined);
  assert.equal(
    tracker.observe(
      [{ ...initial, readAt: "2026-01-01T11:30:00.000Z" }, older],
      true,
    ),
    undefined,
  );
  assert.equal(tracker.observe([newest, newer, initial], true), newest);
  assert.equal(tracker.observe([newest, newer, initial], true), undefined);
  assert.equal(tracker.observe([older], true), undefined);
});

test("an empty initial page allows a later arrival, while read rows never alert", () => {
  const tracker = createArrivalTracker();
  const read = row(
    "read",
    "2026-01-01T11:00:00.000Z",
    "2026-01-01T11:01:00.000Z",
  );
  const unread = row("unread", "2026-01-01T12:00:00.000Z");

  assert.equal(tracker.observe([], true), undefined);
  assert.equal(tracker.observe([read], true), undefined);
  assert.equal(tracker.observe([unread, read], true), unread);
  assert.equal(tracker.observe([unread, read], true), undefined);
});

test("a later committed notification may have an older creation timestamp", () => {
  const tracker = createArrivalTracker();
  const initial = row("initial", "2026-01-01T11:00:00.000Z");
  const late = row("late", "2026-01-01T10:59:00.000Z");

  assert.equal(tracker.observe([initial], true), undefined);
  assert.equal(tracker.observe([initial, late], true), late);
  assert.equal(tracker.observe([initial, late], true), undefined);
});
