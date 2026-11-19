import assert from "node:assert/strict";
import test from "node:test";
import type { Quotation } from "../../src/lib/data/quotations/quotations";
import { findLatestSentQuotation } from "../../src/lib/services/quotations/latest-sent-quotation.ts";

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
  acceptedAt: null,
  supersededAt: status === "superseded" ? "2090-02-01T00:00:00.000Z" : null,
  offeredPackageId: null,
  adjustmentsReviewed: true,
  previousQuotationId: version > 1 ? `quotation-${version - 1}` : null,
  revisionReason: null,
  items: [],
});

const page = (quotations: Quotation[], nextCursor: string | null = null) => ({
  quotations,
  nextCursor,
  currentDraft: null,
  currentOffer: null,
  previousDraftVersion: null,
});

test("admin lookup skips a newer unsent draft and returns the newest sent version", async () => {
  const sent = quotation(2, "sent", "2090-02-02T00:00:00.000Z");
  const calls: unknown[][] = [];

  const result = await findLatestSentQuotation(
    "booking-1",
    true,
    async (...args) => {
      calls.push(args);

      return page([
        quotation(3, "draft", null),
        sent,
        quotation(1, "superseded", "2090-01-01T00:00:00.000Z"),
      ]);
    },
  );

  assert.equal(result, sent);
  assert.deepEqual(calls, [["booking-1", true, {}]]);
});

test("a superseded sent quotation remains eligible even when a newer draft exists", async () => {
  const sent = quotation(2, "superseded", "2090-02-02T00:00:00.000Z");

  const result = await findLatestSentQuotation("booking-1", false, async () =>
    page([quotation(3, "draft", null), sent]),
  );

  assert.equal(result, sent);
});

test("lookup follows cursors, including after an empty page, with booking and role scope", async () => {
  const sent = quotation(1, "sent", "2090-01-01T00:00:00.000Z");
  const calls: unknown[][] = [];
  const pages = [
    page([quotation(2, "draft", null)], "cursor-empty"),
    page([], "cursor-sent"),
    page([sent]),
  ];

  const result = await findLatestSentQuotation(
    "booking-1",
    false,
    async (...args) => {
      calls.push(args);
      const nextPage = pages.shift();

      if (!nextPage)
        throw new Error("loader should only be called for available pages");

      return nextPage;
    },
  );

  assert.equal(result, sent);
  assert.deepEqual(calls, [
    ["booking-1", false, {}],
    ["booking-1", false, { cursor: "cursor-empty" }],
    ["booking-1", false, { cursor: "cursor-sent" }],
  ]);
});

test("returns null when every page has no sent quotation", async () => {
  const pages = [
    page([quotation(2, "draft", null)], "next"),
    page([quotation(1, "draft", null)]),
  ];

  const result = await findLatestSentQuotation("booking-1", true, async () => {
    const nextPage = pages.shift();

    if (!nextPage)
      throw new Error("loader should only be called for available pages");

    return nextPage;
  });

  assert.equal(result, null);
});

test("propagates page loading errors", async () => {
  const error = new Error("quotation page unavailable");
  await assert.rejects(
    findLatestSentQuotation("booking-1", false, async () => {
      throw error;
    }),
    error,
  );
});

test("skips superseded versions that were never sent", async () => {
  const accepted = quotation(1, "accepted", "2090-01-01T00:00:00.000Z");

  const result = await findLatestSentQuotation("booking-1", true, async () =>
    page([
      quotation(3, "draft", null),
      quotation(2, "superseded", null),
      accepted,
    ]),
  );

  assert.equal(result, accepted);
});

test("rejects repeated pagination cursors rather than looping or claiming no offer", async () => {
  await assert.rejects(
    findLatestSentQuotation("booking-1", true, async () =>
      page([], "repeated"),
    ),
    /Unable to load quotation history/,
  );
});
