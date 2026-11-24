import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { deleteApp, getApps } from "firebase-admin/app";
import { config } from "../src/env.js";
import { getFirebaseAuth } from "../src/utils/firebase-admin.js";
import { firebaseServiceAccountJson } from "./helpers/firebase-service-account.js";

const projectId = "demo-event-management";
const original = config.FIREBASE_SERVICE_ACCOUNT_JSON;

let credentials: string;

before(() => {
  credentials = firebaseServiceAccountJson(projectId);
});

beforeEach(() => {
  config.FIREBASE_SERVICE_ACCOUNT_JSON = undefined;
});

afterEach(async () => {
  await Promise.all(getApps().map(deleteApp));
});

after(() => {
  config.FIREBASE_SERVICE_ACCOUNT_JSON = original;
});

test("concurrent JSON credential loads return the same Firebase Auth instance", async () => {
  config.FIREBASE_SERVICE_ACCOUNT_JSON = credentials;

  const instances = await Promise.all(
    Array.from({ length: 8 }, () => getFirebaseAuth()),
  );

  assert.equal(getApps().length, 1);

  for (const instance of instances) assert.equal(instance, instances[0]);

  assert.equal(instances[0].app.options.projectId, projectId);
  assert.equal(await getFirebaseAuth(), instances[0]);
});

test("Firebase Admin requires the service-account JSON setting", async () => {
  await assert.rejects(getFirebaseAuth(), {
    message: "Firebase Admin requires FIREBASE_SERVICE_ACCOUNT_JSON.",
  });
  assert.equal(getApps().length, 0);
});

test("invalid service-account secrets fail safely and can be corrected", async () => {
  for (const invalid of [
    '{"private_key":"dummy-secret-marker"',
    '{"project_id":"demo-event-management"}',
    JSON.stringify({
      project_id: "demo-event-management",
      client_email: "test@demo-event-management.iam.gserviceaccount.com",
      private_key: "dummy-secret-marker",
    }),
  ]) {
    config.FIREBASE_SERVICE_ACCOUNT_JSON = invalid;
    await assert.rejects(getFirebaseAuth(), {
      message:
        "FIREBASE_SERVICE_ACCOUNT_JSON must contain valid Firebase service-account JSON with project_id, client_email, and private_key.",
    });
    assert.equal(getApps().length, 0);
  }

  config.FIREBASE_SERVICE_ACCOUNT_JSON = credentials;
  const auth = await getFirebaseAuth();
  assert.equal(auth.app.options.projectId, projectId);
});
