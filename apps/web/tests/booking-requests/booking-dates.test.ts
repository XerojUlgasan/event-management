import assert from "node:assert/strict";
import test from "node:test";
import {
  dateError,
  earliestSelectableEventDate,
} from "../../src/lib/utils/booking-requests/booking-dates";

test("validates independent nonconsecutive future dates and rejects duplicates and invalid dates", () => {
  const earliest = "2026-12-01";
  const dates = [earliest, "2026-12-03"];

  assert.equal(dateError(dates[0], 0, dates, earliest), "");
  assert.equal(dateError(dates[1], 1, dates, earliest), "");
  assert.match(
    dateError(dates[0], 1, [dates[0], dates[0]], earliest),
    /different/,
  );
  assert.match(
    dateError("2099-02-30", 0, ["2099-02-30"], earliest),
    /valid date/,
  );
  assert.match(dateError("", 0, [""], earliest), /valid date/);
  assert.equal(
    dateError("2026-11-30", 0, ["2026-11-30"], earliest),
    "Choose 2026-12-01 or later.",
  );
});

test("the minimum advances at Philippine midnight and allows the next calendar day", () => {
  assert.equal(
    earliestSelectableEventDate(new Date("2026-11-30T15:59:59Z")),
    "2026-12-01",
  );
  assert.equal(
    earliestSelectableEventDate(new Date("2026-11-30T16:00:00Z")),
    "2026-12-02",
  );
});
