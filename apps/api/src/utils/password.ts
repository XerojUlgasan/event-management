import { Algorithm, hash, verify } from "@node-rs/argon2";

export function hashPassword(password: string) {
  return hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

// Do the same expensive check for unknown accounts and Firebase-only accounts.
const dummyHash = hashPassword("unused-account-password");

export async function verifyPassword(
  passwordHash: string | null,
  password: string,
) {
  const matches = await verify(passwordHash ?? (await dummyHash), password);
  return passwordHash !== null && matches;
}
