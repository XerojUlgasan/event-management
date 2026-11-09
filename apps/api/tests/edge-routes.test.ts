import assert from "node:assert/strict";
import test from "node:test";
import { matchRouteFamily } from "../src/edge/match-route.js";

test("route families follow the longest owned prefix", () => {
  assert.equal(matchRouteFamily("/v1/health"), "health");
  assert.equal(matchRouteFamily("/v1/me"), "auth");
  assert.equal(matchRouteFamily("/v1/auth/login"), "auth");
  assert.equal(matchRouteFamily("/v1/messages"), "messages");
  assert.equal(matchRouteFamily("/v1/admin/conversations/abc"), "messages");
  assert.equal(matchRouteFamily("/v1/admin/users"), "users");
  assert.equal(matchRouteFamily("/v1/admin/packages/pkg"), "packages");
  assert.equal(matchRouteFamily("/v1/packages"), "packages");
  assert.equal(matchRouteFamily("/v1/admin/booking-requests/calendar"), "booking-requests");
  assert.equal(matchRouteFamily("/v1/booking-requests/mine"), "booking-requests");
  assert.equal(matchRouteFamily("/v1/admin/catalog-media"), "catalog-media");
  assert.equal(matchRouteFamily("/v1/catalog-media/asset"), "catalog-media");
  assert.equal(matchRouteFamily("/v1/services/svc"), "services");
  assert.equal(matchRouteFamily("/v1/venues"), "venues");
});

test("unknown paths and near-miss prefixes stay unmatched", () => {
  assert.equal(matchRouteFamily("/v1/healthcheck"), null);
  assert.equal(matchRouteFamily("/v1/admin"), null);
  assert.equal(matchRouteFamily("/v1/media"), null);
  assert.equal(matchRouteFamily("/openapi.json"), null);
});
