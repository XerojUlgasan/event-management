import assert from "node:assert/strict";
import { generateKeyPair } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";
import { promisify } from "node:util";
import { deleteApp, getApps } from "firebase-admin/app";
import { getFirebaseAuth } from "../src/utils/firebase-admin.js";
import { setTestConfig } from "./helpers/set-test-config.js";

const variables = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT",
] as const;

const original = new Map(variables.map((name) => [name, process.env[name]]));

let directory: string;
let credentialsFile: string;
let credentials: string;

before(async () => {
  for (const name of variables) setTestConfig({ [name]: undefined });

  directory = await mkdtemp(join(tmpdir(), "clemora-firebase-test-"));
  credentialsFile = join(directory, "service-account.json");
  setTestConfig({ GOOGLE_APPLICATION_CREDENTIALS: credentialsFile });
  const { privateKey } = await promisify(generateKeyPair)("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  credentials = JSON.stringify({
    project_id: "demo-event-management",
    client_email: "test@demo-event-management.iam.gserviceaccount.com",
    private_key: privateKey,
  });
});

afterEach(async () => {
  await Promise.all(getApps().map(deleteApp));
});

after(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });

  for (const [name, value] of original) {
    setTestConfig({ [name]: value });
  }
});

test("concurrent credential loads return the same Firebase Auth instance", async () => {
  await writeFile(credentialsFile, credentials);

  const instances = await Promise.all(
    Array.from({ length: 8 }, () => getFirebaseAuth()),
  );

  assert.equal(getApps().length, 1);

  for (const instance of instances) assert.equal(instance, instances[0]);

  assert.equal(instances[0].app.options.projectId, "demo-event-management");
  assert.equal(await getFirebaseAuth(), instances[0]);
});

test("failed credential loading can recover after the file is corrected", async () => {
  await writeFile(credentialsFile, "invalid JSON");
  await assert.rejects(getFirebaseAuth(), SyntaxError);
  assert.equal(getApps().length, 0);
  await writeFile(credentialsFile, credentials);
  const auth = await getFirebaseAuth();
  assert.equal(auth.app.options.projectId, "demo-event-management");
  assert.equal(getApps().length, 1);
});
