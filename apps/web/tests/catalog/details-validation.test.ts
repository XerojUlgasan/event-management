import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  PackageContent,
  ServiceContent,
} from "@event-management/contracts/catalog";
import {
  validatePackageDetails,
  validateServiceDetails,
} from "../../src/lib/utils/catalog/details-validation.ts";

const packageContent: PackageContent = {
  name: "Reception",
  description: "",
  maxGuests: 100,
  price: { kind: "fixed", currency: "PHP", amountMinor: 2500000 },
  sections: [],
};

const serviceContent: ServiceContent = {
  name: "Event host",
  description: "Hosting for your event.",
  hourlyRatePesos: 500,
  fixedPricePesos: null,
  includedHours: null,
  sections: [],
};

test("package setup accepts an optional description and rejects missing essentials", () => {
  assert.equal(validatePackageDetails(packageContent), undefined);
  assert.ok(validatePackageDetails({ ...packageContent, name: "   " }));

  for (const maxGuests of [0, -1, 1.5, NaN, 2147483648])
    assert.ok(validatePackageDetails({ ...packageContent, maxGuests }));

  for (const amountMinor of [0, -100, 150, NaN, 2147483700])
    assert.ok(
      validatePackageDetails({
        ...packageContent,
        price: { ...packageContent.price, amountMinor },
      }),
    );
});

test("service setup requires trimmed name, description and a positive whole-peso rate", () => {
  assert.equal(validateServiceDetails(serviceContent), undefined);
  assert.ok(validateServiceDetails({ ...serviceContent, name: "   " }));
  assert.ok(validateServiceDetails({ ...serviceContent, description: "   " }));

  for (const hourlyRatePesos of [null, 0, -1, 1.5, NaN, 2147483648])
    assert.ok(validateServiceDetails({ ...serviceContent, hourlyRatePesos }));
});

test("fixed service setup requires both positive whole-peso price and whole included hours", () => {
  assert.equal(
    validateServiceDetails({
      ...serviceContent,
      fixedPricePesos: 1500,
      includedHours: 3,
    }),
    undefined,
  );
  assert.ok(
    validateServiceDetails({ ...serviceContent, fixedPricePesos: 1500 }),
  );
  assert.ok(validateServiceDetails({ ...serviceContent, includedHours: 3 }));

  for (const value of [0, -1, 1.5, NaN, 2147483648]) {
    assert.ok(
      validateServiceDetails({
        ...serviceContent,
        fixedPricePesos: value,
        includedHours: 3,
      }),
    );
    assert.ok(
      validateServiceDetails({
        ...serviceContent,
        fixedPricePesos: 1500,
        includedHours: value,
      }),
    );
  }
});
