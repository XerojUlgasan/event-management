import assert from "node:assert/strict";
import test from "node:test";
import {
  adminBookingRequestId,
  adminBookingRequestPath,
  adminKey,
  allowedWorkspacePath,
  workspaceReturnPath,
} from "../src/components/app/routes";

const admin = { role: "admin", staffRole: "System Administrator" };
const staff = { role: "staff", staffRole: "Coordinator" };
const customer = { role: "customer", staffRole: null };
const restrictedAdmin = { role: "admin", staffRole: "Coordinator" };
const id = "01c8d471-f0c5-4b16-8594-3bb08e497761";
const detail = `/app/bookings/${id}`;

test("admin booking links open the detail workspace with Bookings selected", () => {
  assert.equal(adminBookingRequestPath(id), detail);
  assert.equal(adminBookingRequestId(detail), id);
  assert.equal(adminBookingRequestId(`${detail}/`), id);
  assert.equal(adminKey(detail), "Bookings");
  assert.equal(adminKey("/app/bookings"), "Bookings");
  assert.equal(allowedWorkspacePath(admin, detail), true);
});

test("customers and staff cannot enter an admin booking detail path", () => {
  for (const profile of [customer, staff, restrictedAdmin])
    assert.equal(allowedWorkspacePath(profile, detail), false);
  assert.equal(allowedWorkspacePath(customer, "/app/events"), true);
  assert.equal(allowedWorkspacePath(staff, "/app/assignments"), true);
  for (const path of [
    "/app/bookings//",
    `${detail}/staff`,
    "/app/bookings/%2Fmessages",
    "/app/bookings/..",
    "/app/bookings/<invalid>",
  ])
    assert.equal(adminBookingRequestId(path), null);
});

test("sign-in returns to local role-authorized booking links only", () => {
  assert.equal(workspaceReturnPath(admin, detail), detail);
  assert.equal(
    workspaceReturnPath(admin, `${detail}?day=2026-11-20`),
    `${detail}?day=2026-11-20`,
  );
  for (const value of [
    null,
    "https://example.test",
    "//example.test/app/bookings",
    "/app/\\example.test",
    "/login",
    "/app/bookings/../../outside",
  ])
    assert.equal(workspaceReturnPath(admin, value), null);
  assert.equal(workspaceReturnPath(customer, detail), null);
  assert.equal(workspaceReturnPath(staff, detail), null);
  assert.equal(workspaceReturnPath(restrictedAdmin, detail), null);
  assert.equal(workspaceReturnPath(customer, "/app/events"), "/app/events");
});
