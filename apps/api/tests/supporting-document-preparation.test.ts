import assert from "node:assert/strict";
import { test } from "node:test";
import { SUPPORTING_DOCUMENT_MAX_BYTES } from "@event-management/contracts/supporting-documents";
import {
  SUPPORTING_DOCUMENT_MAX_OVERLAP_TOKENS,
  SUPPORTING_DOCUMENT_MAX_PAGES,
  SUPPORTING_DOCUMENT_MAX_TOKENS,
  SUPPORTING_DOCUMENT_TARGET_TOKENS,
  estimateTokens,
} from "../src/services/supporting-documents/document-limits.js";
import { prepareSupportingDocument } from "../src/services/supporting-documents/prepare-document.js";
import {
  buildPdf,
  imagePage,
  textPage,
  type PdfPage,
  type TextRun,
} from "./fixtures/supporting-pdf.js";

test("token estimate and caller bounds stay explicit", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
  assert.equal(SUPPORTING_DOCUMENT_TARGET_TOKENS, 512);
  assert.equal(SUPPORTING_DOCUMENT_MAX_TOKENS, 1024);
  assert.equal(SUPPORTING_DOCUMENT_MAX_OVERLAP_TOKENS, 64);
  assert.ok(SUPPORTING_DOCUMENT_MAX_PAGES >= 100);
  assert.equal(SUPPORTING_DOCUMENT_MAX_BYTES, 25 * 1024 * 1024);
});

test("text pages keep physical order, headings, and cross-page sentences", async () => {
  const pdf = buildPdf({
    title: "IGNORE ME TITLE",
    pages: [
      textPage([
        { text: "Payments", size: 18, x: 72, y: 720 },
        { text: "The deposit is due", size: 12, x: 72, y: 680 },
        { text: "1", size: 10, x: 300, y: 36 },
      ]),
      textPage([{ text: "before Friday.", size: 12, x: 72, y: 720 }]),
      textPage([]),
      textPage([{ text: "3", size: 10, x: 300, y: 36 }]),
      textPage([
        { text: "Cancellation", size: 18, x: 72, y: 720 },
        { text: "Notice starts the review.", size: 12, x: 72, y: 680 },
      ]),
    ],
  });
  const prepared = await prepareSupportingDocument(pdf);

  assert.equal(prepared.kind, "complete");

  if (prepared.kind !== "complete") return;

  assert.equal(prepared.pageCount, 5);
  assert.equal(prepared.chunks.length, 2);
  assert.deepEqual(
    prepared.chunks.map((chunk) => chunk.ordinal),
    [1, 2],
  );
  assert.equal(prepared.chunks[0]?.pageStart, 1);
  assert.equal(prepared.chunks[0]?.pageEnd, 2);
  assert.deepEqual(prepared.chunks[0]?.headingPath, ["Payments"]);
  assert.match(
    prepared.chunks[0]?.contentText ?? "",
    /^Payments\n\nThe deposit is due before Friday\./,
  );
  assert.equal(prepared.chunks[1]?.pageStart, 5);
  assert.equal(prepared.chunks[1]?.pageEnd, 5);
  assert.deepEqual(prepared.chunks[1]?.headingPath, ["Cancellation"]);
  assert.match(
    prepared.chunks[1]?.contentText ?? "",
    /Notice starts the review\./,
  );
  assert.equal(
    prepared.chunks.some((chunk) =>
      chunk.contentText.includes("IGNORE ME TITLE"),
    ),
    false,
  );
  assert.deepEqual(await prepareSupportingDocument(pdf), prepared);
});

test("two columns read down the left column before the right column", async () => {
  const left = ["Alpha one", "Alpha two", "Alpha three", "Alpha four"];
  const right = ["Beta one", "Beta two", "Beta three", "Beta four"];

  const runs = left.flatMap((text, index) => [
    { text, size: 12, x: 72, y: 700 - index * 22 },
    { text: right[index] ?? "", size: 12, x: 360, y: 700 - index * 22 },
  ]);

  const prepared = await prepareSupportingDocument(
    buildPdf({ pages: [textPage(runs)] }),
  );

  assert.equal(prepared.kind, "complete");

  if (prepared.kind !== "complete") return;

  assert.match(
    prepared.chunks[0]?.contentText ?? "",
    /Alpha one Alpha two Alpha three Alpha four Beta one Beta two Beta three Beta four/,
  );
});

test("a 120-page PDF keeps text from its first and last physical pages", async () => {
  const pages = Array.from({ length: 120 }, (_, index) =>
    textPage([
      {
        text: `Item ${index + 1}: Confirm the delivery arrangements with the venue team.`,
        size: 12,
        x: 72,
        y: 720,
      },
    ]),
  );

  const result = await prepareSupportingDocument(buildPdf({ pages }));

  assert.equal(result.kind, "complete");

  if (result.kind !== "complete") return;

  assert.equal(result.pageCount, 120);
  assert.equal(result.chunks[0]?.pageStart, 1);
  assert.equal(result.chunks.at(-1)?.pageEnd, 120);
  assert.match(result.chunks.at(-1)?.contentText ?? "", /Item 120: Confirm/);
});

test("long sections target the token budget and overlap inside the heading", async () => {
  const prepared = await prepareSupportingDocument(
    buildPdf({
      pages: [
        ...flowPages("Payments", sentences("payment", 160)),
        ...flowPages("Cancellation", sentences("cancel", 20)),
      ],
    }),
  );

  assert.equal(prepared.kind, "complete");

  if (prepared.kind !== "complete") return;

  const paymentChunks = prepared.chunks.filter(
    (chunk) => chunk.headingPath.join(" > ") === "Payments",
  );

  const cancelChunks = prepared.chunks.filter(
    (chunk) => chunk.headingPath.join(" > ") === "Cancellation",
  );

  assert.ok(paymentChunks.length >= 2);
  assert.ok(cancelChunks.length >= 1);

  for (const chunk of prepared.chunks) {
    assert.ok(
      estimateTokens(chunk.contentText) <= SUPPORTING_DOCUMENT_MAX_TOKENS,
    );
    assert.ok(chunk.pageStart >= 1);
    assert.ok(chunk.pageEnd >= chunk.pageStart);
  }

  const first = bodyOf(paymentChunks[0]?.contentText ?? "");
  const second = bodyOf(paymentChunks[1]?.contentText ?? "");
  const overlap = sharedSuffixPrefix(first, second);

  assert.ok(overlap.length > 0);
  assert.ok(estimateTokens(overlap) <= SUPPORTING_DOCUMENT_MAX_OVERLAP_TOKENS);
  assert.ok(second.length > overlap.length);
  assert.equal(cancelChunks[0]?.contentText.includes("payment"), false);
  assert.match(cancelChunks[0]?.contentText ?? "", /^Cancellation\n\ncancel/);

  const fullChunks = paymentChunks.slice(0, -1);

  for (const chunk of fullChunks) {
    const tokens = estimateTokens(chunk.contentText);

    assert.ok(tokens >= SUPPORTING_DOCUMENT_TARGET_TOKENS - 80);
    assert.ok(tokens < SUPPORTING_DOCUMENT_MAX_TOKENS);
  }
});

test("a scanned page keeps the document out of the ready result", async () => {
  const prepared = await prepareSupportingDocument(
    buildPdf({
      pages: [
        textPage([{ text: "Readable policy text.", size: 12, x: 72, y: 700 }]),
        imagePage("2"),
        textPage([{ text: "Later policy text.", size: 12, x: 72, y: 700 }]),
      ],
    }),
  );

  assert.deepEqual(prepared, {
    kind: "needs_review",
    pageCount: 3,
    unreadablePages: [2],
  });
});

test("a page number on a blank page is not an unreadable scan", async () => {
  const prepared = await prepareSupportingDocument(
    buildPdf({
      pages: [
        textPage([{ text: "Only the written page.", size: 12, x: 72, y: 700 }]),
        textPage([{ text: "4", size: 10, x: 300, y: 36 }]),
      ],
    }),
  );

  assert.equal(prepared.kind, "complete");

  if (prepared.kind !== "complete") return;

  assert.equal(prepared.pageCount, 2);
  assert.equal(prepared.chunks.length, 1);
  assert.equal(prepared.chunks[0]?.pageStart, 1);
  assert.equal(prepared.chunks[0]?.pageEnd, 1);
});

test("image-only and blank documents stay distinct", async () => {
  const scanned = await prepareSupportingDocument(
    buildPdf({ pages: [imagePage(), imagePage("3")] }),
  );
  const blank = await prepareSupportingDocument(
    buildPdf({ pages: [textPage([]), textPage([])] }),
  );

  assert.deepEqual(scanned, {
    kind: "needs_review",
    pageCount: 2,
    unreadablePages: [1, 2],
  });
  assert.deepEqual(blank, { kind: "complete", pageCount: 2, chunks: [] });
});

test("invalid, aborted, and oversized documents fail closed", async () => {
  const invalid = await prepareSupportingDocument(
    new TextEncoder().encode("not a pdf"),
  );
  const aborted = await prepareSupportingDocument(
    buildPdf({
      pages: [textPage([{ text: "Hello.", size: 12, x: 72, y: 700 }])],
    }),
    AbortSignal.abort(),
  );

  const oversized = await prepareSupportingDocument(
    buildPdf({
      pages: Array.from({ length: SUPPORTING_DOCUMENT_MAX_PAGES + 1 }, () =>
        textPage([]),
      ),
    }),
  );

  assert.deepEqual(invalid, { kind: "failed", code: "invalid_pdf" });
  assert.deepEqual(aborted, { kind: "failed", code: "aborted" });
  assert.deepEqual(oversized, { kind: "failed", code: "page_limit_exceeded" });
});

function bodyOf(content: string): string {
  const split = content.split("\n\n");

  return split.length > 1 ? split.slice(1).join("\n\n") : content;
}

function sharedSuffixPrefix(left: string, right: string): string {
  const leftWords = left.split(" ");
  const rightWords = right.split(" ");
  const max = Math.min(leftWords.length, rightWords.length);

  for (let count = max; count > 0; count -= 1) {
    const suffix = leftWords.slice(leftWords.length - count).join(" ");

    if (suffix === rightWords.slice(0, count).join(" ")) return suffix;
  }

  return "";
}

function sentences(label: string, count: number): string {
  const lines: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const words = Array.from(
      { length: 12 },
      (_, word) => `${label}${index}w${word}`,
    );

    lines.push(`${words.join(" ")}.`);
  }

  return lines.join(" ");
}

function flowPages(heading: string, body: string): PdfPage[] {
  const pages: PdfPage[] = [];
  let runs: TextRun[] = [{ text: heading, size: 18, x: 72, y: 740 }];
  let y = 710;
  let line: string[] = [];

  const flushLine = () => {
    if (line.length === 0) return;

    if (y < 72) {
      pages.push(textPage(runs));
      runs = [];
      y = 740;
    }

    runs.push({ text: line.join(" "), size: 12, x: 72, y });
    line = [];
    y -= 16;
  };

  for (const word of body.split(" ")) {
    line.push(word);

    if (line.join(" ").length > 70) flushLine();
  }

  flushLine();

  if (runs.length > 0) pages.push(textPage(runs));

  return pages;
}
