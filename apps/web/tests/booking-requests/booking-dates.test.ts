import assert from "node:assert/strict";
import test from "node:test";
import { dateError } from "../../src/lib/utils/booking-requests/booking-dates";

test("validates independent nonconsecutive future dates and rejects duplicates and invalid dates", () => {
  const dates = ["2099-12-05", "2099-12-07"];
  assert.equal(dateError(dates[0], 0, dates, "Asia/Manila"), "");
  assert.equal(dateError(dates[1], 1, dates, "Asia/Manila"), "");
  assert.match(
    dateError(dates[0], 1, [dates[0], dates[0]], "Asia/Manila"),
    /different/,
  );
  assert.match(
    dateError("2099-02-30", 0, ["2099-02-30"], "Asia/Manila"),
    /valid date/,
  );
  assert.match(dateError("", 0, [""], "Asia/Manila"), /valid date/);
  assert.match(
    dateError("2000-01-01", 0, ["2000-01-01"], "Asia/Manila"),
    /future/,
  );
});
