import assert from "node:assert/strict";
import test from "node:test";
import { localInput, zonedInstant } from "../src/lib/utils/event-day-time";

test("converts booking-zone wall times independently of browser zone", () => {
  assert.equal(zonedInstant("2026-12-05T21:30", "Asia/Manila"), "2026-12-05T13:30:00.000Z");
  assert.equal(localInput("2026-12-05T17:00:00.000Z", "Asia/Manila"), "2026-12-06T01:00");
});

test("rejects missing and repeated daylight-saving local times", () => {
  assert.throws(() => zonedInstant("2026-03-08T02:30", "America/New_York"), /does not exist/);
  assert.throws(() => zonedInstant("2026-11-01T01:30", "America/New_York"), /occurs twice/);
});

test("rejects normalized invalid dates and unsupported early years", () => {
  assert.throws(() => zonedInstant("2026-02-30T10:00", "Asia/Manila"), /valid date/);
  assert.throws(() => zonedInstant("0099-01-01T10:00", "Asia/Manila"), /valid date/);
  assert.throws(() => zonedInstant("2026-12-05T25:00", "Asia/Manila"), /valid date/);
});
