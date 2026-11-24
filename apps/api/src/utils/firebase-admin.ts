import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { config } from "../env.js";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const configurationError =
  "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (or GOOGLE_APPLICATION_CREDENTIALS) in apps/api/.env.";

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

async function initialize() {
  const projectId = config.FIREBASE_PROJECT_ID;
  const clientEmail = config.FIREBASE_CLIENT_EMAIL;
  const privateKey = config.FIREBASE_PRIVATE_KEY;

  if (config.FIREBASE_AUTH_EMULATOR_HOST && projectId) {
    initializeApp({ projectId });

    return;
  }

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });

    return;
  }

  const credentialsPath = config.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialsPath) {
    const credentialsFile = isAbsolute(credentialsPath)
      ? credentialsPath
      : resolve(apiRoot, credentialsPath);

    const serviceAccount = JSON.parse(
      await readFile(credentialsFile, "utf8"),
    ) as ServiceAccount;

    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error(`Invalid service account file at ${credentialsFile}`);
    }

    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id ?? projectId,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
      projectId: serviceAccount.project_id ?? projectId,
    });

    return;
  }

  if (config.GOOGLE_CLOUD_PROJECT || config.GCLOUD_PROJECT) {
    initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });

    return;
  }

  throw new Error(configurationError);
}

let initialization: Promise<void> | undefined;

export async function getFirebaseAuth() {
  if (!getApps().length) {
    initialization ??= initialize().finally(() => {
      initialization = undefined;
    });
    await initialization;
  }

  return getAuth();
}
