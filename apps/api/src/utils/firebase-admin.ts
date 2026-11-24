import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { z } from "zod";

import { config } from "../env.js";

const serviceAccountSecret = z.object({
  project_id: z.string().trim().min(1),
  client_email: z.string().trim().min(1),
  private_key: z.string().trim().min(1),
});

export async function getFirebaseAuth() {
  if (!getApps().length) {
    const serviceAccountJson = config.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

    if (!serviceAccountJson) {
      throw new Error("Firebase Admin requires FIREBASE_SERVICE_ACCOUNT_JSON.");
    }

    try {
      const account = serviceAccountSecret.parse(
        JSON.parse(serviceAccountJson),
      );
      initializeApp({
        credential: cert({
          projectId: account.project_id,
          clientEmail: account.client_email,
          privateKey: account.private_key,
        }),
        projectId: account.project_id,
      });
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON must contain valid Firebase service-account JSON with project_id, client_email, and private_key.",
      );
    }
  }

  return getAuth();
}
