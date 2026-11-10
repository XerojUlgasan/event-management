import assert from "node:assert/strict";
import test from "node:test";
import { responseDeadlineForDay } from "@event-management/contracts/event-days";

test("preview uses each calendar date and end of day in the booking timezone", () => {
  const dates = ["2027-01-01", "2027-01-10", "2027-01-15"];
  assert.deepEqual(dates.map(day => responseDeadlineForDay(day, 2, "Asia/Manila")), [
    "2026-12-30T15:59:59.999Z", "2027-01-08T15:59:59.999Z", "2027-01-13T15:59:59.999Z",
  ]);
});

test("invalid local end-of-day is reported to the preview", () => {
  assert.throws(() => responseDeadlineForDay("2012-01-01", 2, "Pacific/Apia"));
});
