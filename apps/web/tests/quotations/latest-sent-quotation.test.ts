import assert from "node:assert/strict";
import test from "node:test";
import type { Quotation } from "../../src/lib/data/quotations/quotations";
import { getLatestSentQuotation } from "../../src/lib/services/quotations/latest-sent-quotation.ts";

const quotation = (
  version: number,
  status: Quotation["status"],
  sentAt: string | null,
): Quotation => ({
  id: `quotation-${version}`,
  bookingRequestId: "booking-1",
  version,
  currency: "PHP",
  baseAmountMinor: 100_000,
  totalAmountMinor: 100_000,
  status,
  createdBy: "admin-1",
  createdAt: `2090-01-${String(version).padStart(2, "0")}T00:00:00.000Z`,
  updatedAt: `2090-01-${String(version).padStart(2, "0")}T00:00:00.000Z`,
  sentAt,
  supersededAt: status === "superseded" ? "2090-02-01T00:00:00.000Z" : null,
  offeredPackageId: null,
  adjustmentsReviewed: true,
  previousQuotationId: version > 1 ? `quotation-${version - 1}` : null,
  revisionReason: null,
  items: [],
});

for (const admin of [false, true]) {
  test(`latest offer uses the booking scope for ${admin ? "admins" : "customers"}`, async () => {
    const latest = quotation(2, "sent", "2090-02-02T00:00:00.000Z");
    const calls: unknown[][] = [];

    const actual = await getLatestSentQuotation(
      "booking-1",
      admin,
      async (...args) => {
        calls.push(args);

        return {
          quotations: [],
          nextCursor: "more-history",
          currentOffer: latest,
        };
      },
    );

    assert.equal(actual, latest);
    assert.deepEqual(calls, [["booking-1", admin]]);
  });
}

test("latest offer can be a delivered fallback from older records", async () => {
  const latest = quotation(2, "superseded", "2090-02-02T00:00:00.000Z");

  const actual = await getLatestSentQuotation("booking-1", false, async () => ({
    quotations: [latest],
    nextCursor: null,
    currentOffer: latest,
  }));

  assert.equal(actual, latest);
});

test("returns null when the booking has no delivered offer", async () => {
  const actual = await getLatestSentQuotation("booking-1", false, async () => ({
    quotations: [],
    nextCursor: null,
    currentOffer: null,
  }));

  assert.equal(actual, null);
});
