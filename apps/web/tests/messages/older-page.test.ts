import assert from "node:assert/strict";
import test from "node:test";
import { assertCursorMoved } from "../../src/lib/services/messages/older-page.ts";

test("a repeated cursor is rejected and a moved cursor is kept", () => {
  assert.throws(
    () => assertCursorMoved("same", "same"),
    /Unable to load older messages/,
  );
  assert.throws(
    () =>
      assertCursorMoved(
        "same",
        "same",
        "Unable to load more conversations. Please try again.",
      ),
    /Unable to load more conversations/,
  );
  assert.doesNotThrow(() => assertCursorMoved("next", "same"));
  assert.doesNotThrow(() => assertCursorMoved(null, "same"));
});
