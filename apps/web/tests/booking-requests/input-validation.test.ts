import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidPersonName,
  personNameValidationMessage,
  sanitizePersonNameInput,
} from "@event-management/contracts/person-name";
import {
  formatPhilippineMobileStorage,
  isValidPhilippineMobile,
  parsePhilippineMobileDigits,
  philippineMobileValidationMessage,
} from "@event-management/contracts/philippine-mobile";

test("person name validation allows expected characters", () => {
  assert.equal(sanitizePersonNameInput("Jane Doe3!"), "Jane Doe");
  assert.equal(isValidPersonName("Mary-Jane O'Connor"), true);
  assert.match(personNameValidationMessage("   "), /Enter a name/);
  assert.match(personNameValidationMessage("1234"), /letters/);
});

test("philippine mobile validation enforces ten digits starting with 9", () => {
  assert.equal(parsePhilippineMobileDigits("+63 912 345 6789"), "9123456789");
  assert.equal(isValidPhilippineMobile("9123456789"), true);
  assert.match(
    philippineMobileValidationMessage("8123456789"),
    /start with 9/,
  );
  assert.equal(
    formatPhilippineMobileStorage("9123456789"),
    "+63 912 345 6789",
  );
});