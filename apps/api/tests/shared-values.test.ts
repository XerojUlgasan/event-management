import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarDateInTimeZone,
  zonedFormat,
  zonedPartValues,
} from "@event-management/contracts/calendar-date";
import {
  centavosToPesos,
  pesosToCentavos,
} from "@event-management/contracts/money";

test("peso conversion keeps whole pesos and centavos aligned", () => {
  assert.equal(pesosToCentavos(25000), 2_500_000);
  assert.equal(centavosToPesos(2_500_000), 25000);
  assert.equal(pesosToCentavos(10.5), 1050);
  assert.equal(centavosToPesos(150), 1.5);
});

test("civil dates follow the IANA zone, including the previous local day", () => {
  assert.equal(
    calendarDateInTimeZone(new Date("2026-11-18T16:30:00Z"), "Asia/Manila"),
    "2026-11-19",
  );
  assert.equal(
    calendarDateInTimeZone(new Date("2026-11-18T15:59:00Z"), "Asia/Manila"),
    "2026-11-18",
  );
  assert.equal(
    calendarDateInTimeZone(
      new Date("2026-01-01T00:30:00Z"),
      "America/New_York",
    ),
    "2025-12-31",
  );
});

test("zoned clock parts use a 00-23 hour", () => {
  const parts = zonedPartValues(
    zonedFormat("Asia/Manila", "minute"),
    new Date("2026-11-17T16:00:00Z"),
  );
  assert.equal(parts.hour, "00");
  assert.equal(parts.minute, "00");
  assert.equal(`${parts.year}-${parts.month}-${parts.day}`, "2026-11-18");
});
