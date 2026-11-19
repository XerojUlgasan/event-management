import assert from "node:assert/strict";
import test from "node:test";
import { matchRouteFamily } from "../src/edge/match-route.js";
import {
  messageBodyLimit,
  MESSAGE_UPLOAD_BODY_LIMIT_BYTES,
  bookingBodyLimit,
  CATALOG_JSON_BODY_LIMIT_BYTES,
  SMALL_JSON_BODY_LIMIT_BYTES,
} from "../src/constants/http.js";

test("route families follow the longest owned prefix", () => {
  assert.equal(matchRouteFamily("/v1/admin/ai/knowledge"), "ai");
  assert.equal(matchRouteFamily("/v1/admin/ai/knowledge/search"), "ai");
  assert.equal(matchRouteFamily("/v1/admin/ai/knowledge/package/id"), "ai");
  assert.equal(matchRouteFamily("/v1/health"), "health");
  assert.equal(matchRouteFamily("/v1/me"), "auth");
  assert.equal(matchRouteFamily("/v1/auth/login"), "auth");
  assert.equal(matchRouteFamily("/v1/messages"), "messages");
  assert.equal(matchRouteFamily("/v1/admin/conversations/abc"), "messages");
  assert.equal(matchRouteFamily("/v1/admin/users"), "users");
  assert.equal(matchRouteFamily("/v1/admin/packages/pkg"), "packages");
  assert.equal(matchRouteFamily("/v1/packages"), "packages");
  assert.equal(
    matchRouteFamily("/v1/admin/booking-requests/calendar"),
    "booking-requests",
  );
  assert.equal(
    matchRouteFamily("/v1/booking-requests/mine"),
    "booking-requests",
  );
  assert.equal(
    matchRouteFamily("/v1/admin/booking-requests/id/quotations"),
    "booking-requests",
  );
  assert.equal(
    matchRouteFamily("/v1/booking-requests/id/quotations"),
    "booking-requests",
  );
  assert.equal(
    matchRouteFamily("/v1/admin/quotations/id/send"),
    "booking-requests",
  );
  assert.equal(
    matchRouteFamily("/v1/quotations/id/accept"),
    "booking-requests",
  );
  assert.equal(matchRouteFamily("/v1/admin/catalog-media"), "catalog-media");
  assert.equal(matchRouteFamily("/v1/catalog-media/asset"), "catalog-media");
  assert.equal(matchRouteFamily("/v1/services/svc"), "services");
});

test("private canvas payloads use the catalog cap in either runtime path format", () => {
  assert.equal(
    bookingBodyLimit("/v1/admin/booking-requests/id/custom-package"),
    CATALOG_JSON_BODY_LIMIT_BYTES,
  );
  assert.equal(
    bookingBodyLimit("/admin/booking-requests/id/custom-package"),
    CATALOG_JSON_BODY_LIMIT_BYTES,
  );
  assert.equal(
    bookingBodyLimit("/admin/booking-requests/id/status"),
    SMALL_JSON_BODY_LIMIT_BYTES,
  );
});

test("unknown paths and near-miss prefixes stay unmatched", () => {
  assert.equal(matchRouteFamily("/v1/admin/ai/knowledgeable"), null);
  assert.equal(matchRouteFamily("/v1/healthcheck"), null);
  assert.equal(matchRouteFamily("/v1/admin"), null);
  assert.equal(matchRouteFamily("/v1/media"), null);
  assert.equal(matchRouteFamily("/openapi.json"), null);
});

test("package attachment uses the booking route family and small body cap", () => {
  assert.equal(
    matchRouteFamily("/v1/admin/booking-requests/id/package"),
    "booking-requests",
  );
  assert.equal(
    bookingBodyLimit("/v1/admin/booking-requests/id/package"),
    SMALL_JSON_BODY_LIMIT_BYTES,
  );
});

test("message image reads and multipart send caps agree in Node and Edge paths", () => {
  assert.equal(matchRouteFamily("/v1/message-images/id"), "message-images");

  for (const path of [
    "/v1/messages/conversation/messages",
    "/messages/conversation/messages",
    "/v1/admin/conversations/id/messages",
    "/guest/conversations/id/messages",
  ]) {
    assert.equal(
      messageBodyLimit(path, "multipart/form-data; boundary=test"),
      MESSAGE_UPLOAD_BODY_LIMIT_BYTES,
    );
    assert.equal(
      messageBodyLimit(path, "application/json"),
      SMALL_JSON_BODY_LIMIT_BYTES,
    );
  }

  assert.equal(
    messageBodyLimit("/guest/conversations/id/claim", "multipart/form-data"),
    SMALL_JSON_BODY_LIMIT_BYTES,
  );
});
