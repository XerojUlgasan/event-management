import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const configurationError =
  "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (or GOOGLE_APPLICATION_CREDENTIALS) in apps/api/.env.";

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

async function initialize() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (process.env.FIREBASE_AUTH_EMULATOR_HOST && projectId) {
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

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

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

  if (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT) {
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
