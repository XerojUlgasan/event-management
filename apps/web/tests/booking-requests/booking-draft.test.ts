import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  clearBookingDraft,
  readBookingDraft,
  saveBookingDraft,
} from "../../src/lib/services/booking-requests/booking-draft.ts";

const entries = new Map<string, string>();

Object.assign(globalThis, {
  sessionStorage: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  },
});

const draft = {
  item: { id: "package", updatedAt: "today", maxGuests: 50 },
  fields: {},
};

const oldKey = "clemora-booking-draft";
const key = "amac-booking-draft";

beforeEach(() => entries.clear());

test("an existing draft is preserved and moved to the AMAC key", () => {
  entries.set(oldKey, JSON.stringify(draft));
  assert.deepEqual(readBookingDraft(), draft);
  assert.equal(entries.has(oldKey), false);
  assert.deepEqual(JSON.parse(entries.get(key)!), draft);
});

test("a current draft takes precedence and clearing removes both keys", () => {
  entries.set(key, JSON.stringify(draft));
  entries.set(
    oldKey,
    JSON.stringify({ ...draft, item: { ...draft.item, id: "old" } }),
  );
  assert.deepEqual(readBookingDraft(), draft);
  clearBookingDraft();
  assert.equal(entries.size, 0);
});

test("saving retires an old draft", () => {
  entries.set(oldKey, JSON.stringify(draft));
  saveBookingDraft(draft as Parameters<typeof saveBookingDraft>[0]);
  assert.equal(entries.has(oldKey), false);
  assert.deepEqual(readBookingDraft(), draft);
});
