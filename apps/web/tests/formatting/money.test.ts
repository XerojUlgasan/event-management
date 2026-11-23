import assert from "node:assert/strict";
import test from "node:test";
import {
  centavosToPesos,
  formatPesosFromMinor,
  formatSignedPesosFromMinor,
  pesosToCentavos,
  priceLabel,
} from "../../src/lib/utils/formatting/money.ts";

test("peso helpers round-trip and format PHP from centavos", () => {
  assert.equal(pesosToCentavos(25000), 2_500_000);
  assert.equal(centavosToPesos(2_500_000), 25000);
  assert.equal(
    formatPesosFromMinor(2_500_000),
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(25000),
  );
  assert.equal(formatSignedPesosFromMinor(10_000).startsWith("+"), true);
  assert.equal(formatSignedPesosFromMinor(-10_000).startsWith("−"), true);
  assert.equal(formatSignedPesosFromMinor(0), formatPesosFromMinor(0));
  assert.equal(priceLabel(null), "Price on request");
  assert.match(priceLabel({ amountMinor: 150000 }), /total$/);
});
