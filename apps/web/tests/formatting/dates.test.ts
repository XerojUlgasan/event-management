import assert from "node:assert/strict";
import test from "node:test";
import {
  enPhDayFormatter,
  enPhTimeFormatter,
  formatEnPhDate,
  formatEnPhDateTime,
} from "../../src/lib/utils/formatting/dates.ts";

const instant = new Date("2026-11-18T02:30:00Z");

test("en-PH date helpers keep medium date and short time styles", () => {
  assert.equal(
    formatEnPhDate(instant, "UTC"),
    new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(instant),
  );
  assert.equal(
    formatEnPhDateTime(instant, "Asia/Manila"),
    new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Manila",
    }).format(instant),
  );
  assert.equal(enPhDayFormatter.format(instant).includes("2026"), true);
  assert.equal(typeof enPhTimeFormatter.format(instant), "string");
});
