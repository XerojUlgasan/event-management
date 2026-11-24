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

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

async function initialize() {
  const firebase = config.FIREBASE_ADMIN;
  const { projectId } = firebase;

  if (firebase.kind === "emulator") {
    initializeApp({ projectId });

    return;
  }

  if (firebase.kind === "serviceAccount") {
    initializeApp({
      credential: cert({
        projectId: firebase.projectId,
        clientEmail: firebase.clientEmail,
        privateKey: firebase.privateKey,
      }),
      projectId: firebase.projectId,
    });

    return;
  }

  if (firebase.kind === "file") {
    const { credentialsPath } = firebase;
    const credentialsFile = isAbsolute(credentialsPath)
      ? credentialsPath
      : resolve(apiRoot, credentialsPath);

    const serviceAccount = JSON.parse(
      await readFile(credentialsFile, "utf8"),
    ) as ServiceAccount;

    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error(`Invalid service account file at ${credentialsFile}`);
    }

    const accountProjectId = serviceAccount.project_id ?? projectId;

    initializeApp({
      credential: cert({
        projectId: accountProjectId,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
      projectId: accountProjectId,
    });

    return;
  }

  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });
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
