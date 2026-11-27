import { createHmac, timingSafeEqual } from "node:crypto";
import {
  legacyWorkerTokenHeader,
  workerTokenHeader,
  type EdgeJobWorker,
} from "../constants/edge-job-workers.js";

const tokenPattern = /^(\d{1,12})\.([0-9a-f]{64})$/;

export async function verifyWorkerToken(
  headers: Headers,
  worker: EdgeJobWorker,
  getSecret: (name: string) => Promise<string | undefined>,
  now = Date.now(),
) {
  // Never mix the old and new header and key. Reject ambiguous requests.
  const current = headers.get(workerTokenHeader);
  const legacy = headers.get(legacyWorkerTokenHeader);

  if (current && legacy) return false;

  const token = tokenPattern.exec(current ?? legacy ?? "");

  if (!token) return false;

  const [, timestamp, signature] = token;
  const age = Math.floor(now / 1000) - Number(timestamp);

  if (age < -5 || age > 30) return false;

  const secret = await getSecret(current ? worker.secret : worker.legacySecret);

  if (!secret) return false;

  const expected = createHmac("sha256", secret).update(timestamp).digest();

  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}
