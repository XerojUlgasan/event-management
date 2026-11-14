import assert from "node:assert/strict";
import test from "node:test";
import { pageQuery } from "../../src/lib/data/catalog/page-query";
import { catalogFilterScope } from "@event-management/contracts/catalog-filters";

test("catalog requests retain filters and opaque cursors, including a zero price", () => {
  const query = pageQuery({
    limit: 15,
    cursor: "opaque+cursor/==",
    minPricePesos: 0,
    maxPricePesos: 50000,
    guests: 100,
  });
  const params = new URLSearchParams(query);
  assert.equal(params.get("cursor"), "opaque+cursor/==");
  assert.equal(params.get("limit"), "15");
  assert.equal(params.get("minPricePesos"), "0");
  assert.equal(params.get("maxPricePesos"), "50000");
  assert.equal(params.get("guests"), "100");
  assert.equal(pageQuery(), "");
});

test("catalog history scopes separate categories and applied filters", () => {
  const scope = catalogFilterScope("packages", {
    guests: 100,
    minPricePesos: 0,
  });
  assert.equal(
    scope,
    catalogFilterScope("packages", { minPricePesos: 0, guests: 100 }),
  );
  assert.notEqual(
    scope,
    catalogFilterScope("packages", { guests: 101, minPricePesos: 0 }),
  );
  assert.notEqual(
    catalogFilterScope("services", { minPricePesos: 0 }),
    catalogFilterScope("services", {}),
  );
});
