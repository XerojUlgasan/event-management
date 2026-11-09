import { randomBytes, timingSafeEqual } from "node:crypto";
import { argon2id } from "hash-wasm";

export function hashPassword(password: string) {
  return argon2id({
    password,
    salt: randomBytes(16),
    memorySize: 19456,
    iterations: 2,
    parallelism: 1,
    hashLength: 32,
    outputType: "encoded",
  });
}

// Do the same expensive check for unknown accounts and Firebase-only accounts.
const dummyHash = hashPassword("unused-account-password");

export async function verifyPassword(
  passwordHash: string | null,
  password: string,
) {
  const encoded = passwordHash ?? (await dummyHash);
  const parameters = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(encoded);
  if (!parameters) throw new Error("Invalid Argon2id password hash");
  const [, memorySize, iterations, parallelism, salt, digest] = parameters;
  const expected = Buffer.from(digest, "base64");
  const actual = await argon2id({
    password,
    salt: Buffer.from(salt, "base64"),
    memorySize: Number(memorySize),
    iterations: Number(iterations),
    parallelism: Number(parallelism),
    hashLength: expected.length,
    outputType: "binary",
  });
  // hash-wasm's verifier compares strings; retain a timing-safe digest comparison.
  const matches = timingSafeEqual(actual, expected);
  return passwordHash !== null && matches;
}
