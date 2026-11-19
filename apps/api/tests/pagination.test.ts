import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { z } from "@hono/zod-openapi";
import { createPage } from "@event-management/contracts/pagination";
import {
  encodePageCursor,
  paginationQuerySchema,
  parsePageCursor,
} from "../src/utils/pagination.js";

const position = z.object({
  name: z.string(),
  id: z.string().uuid(),
  at: z.iso.datetime({ offset: true }),
});

const boundary = {
  name: "José",
  id: "12345678-1234-4234-8234-123456789abc",
  at: "2026-11-13T01:02:03.123456Z",
};

test("pagination preserves complete cursor positions and binds them to the query scope", () => {
  const cursor = encodePageCursor("staff:day-1:available", boundary);
  assert.deepEqual(
    parsePageCursor(cursor, position, "staff:day-1:available"),
    boundary,
  );
  assert.throws(() =>
    parsePageCursor(cursor, position, "staff:day-2:available"),
  );
  assert.throws(() =>
    parsePageCursor(
      cursor,
      z.object({ count: z.number() }),
      "staff:day-1:available",
    ),
  );
  assert.equal(
    parsePageCursor(undefined, position, "staff:day-1:available"),
    undefined,
  );
});
test("invalid and overlong cursors produce a usable HTTP 400 response", async () => {
  const app = new Hono();
  app.get("/", (c) => {
    parsePageCursor(c.req.query("cursor"), position, "staff");

    return c.json({ ok: true });
  });

  for (const cursor of [
    "!",
    "e30",
    "a".repeat(3000),
    encodePageCursor("staff", { ...boundary, id: "bad" }),
  ]) {
    const response = await app.request(
      `/?cursor=${encodeURIComponent(cursor)}`,
    );
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /first page/);
  }
});
test("omitted options are bounded and invalid page sizes are rejected", () => {
  assert.deepEqual(paginationQuerySchema.parse({}), { limit: 15 });

  for (const limit of ["0", "-1", "51", "1.5", "Infinity", "", "abc"])
    assert.equal(paginationQuerySchema.safeParse({ limit }).success, false);

  assert.equal(paginationQuerySchema.parse({ limit: "50" }).limit, 50);
});
test("page continuation comes from the last included row and ends without a phantom page", () => {
  const rows = ["one", "two", "three"];
  assert.deepEqual(
    createPage(rows, 2, (row) => row),
    { items: ["one", "two"], nextCursor: "two" },
  );
  assert.deepEqual(
    createPage(rows.slice(0, 2), 2, (row) => row),
    { items: ["one", "two"], nextCursor: null },
  );
  assert.deepEqual(createPage([], 2, String), { items: [], nextCursor: null });
});
