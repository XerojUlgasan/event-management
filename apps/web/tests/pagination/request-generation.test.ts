import assert from "node:assert/strict";
import test from "node:test";
import { createRequestGeneration } from "../../src/lib/pagination/use-request-generation.ts";

test("a bumped ticket stays current until the next bump", () => {
  const generation = createRequestGeneration();
  assert.equal(generation.current(), 0);
  const first = generation.bump();
  assert.equal(first, 1);
  assert.equal(generation.isCurrent(first), true);
  generation.bump();
  assert.equal(generation.isCurrent(first), false);
});
