import { generateKeyPairSync } from "node:crypto";

export function firebaseServiceAccountJson(projectId: string) {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  return JSON.stringify({
    project_id: projectId,
    client_email: `test@${projectId}.iam.gserviceaccount.com`,
    private_key: privateKey,
  });
}
