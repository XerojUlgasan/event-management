// Basic per-account protection for this single-process API. At multiple replicas,
// enforce a shared limit at the gateway or replace this with a shared store.
const attempts = new Map<string, { count: number; expiresAt: number }>();

const windowMs = 15 * 60 * 1000;
const maxKeys = 10000;

export function allowAuthAttempt(key: string) {
  const now = Date.now();
  let entry = attempts.get(key);

  if (!entry || entry.expiresAt <= now) {
    if (attempts.size >= maxKeys) {
      for (const [name, value] of attempts) {
        if (value.expiresAt <= now) attempts.delete(name);
      }

      if (attempts.size >= maxKeys) return false;
    }

    entry = { count: 0, expiresAt: now + windowMs };
    attempts.set(key, entry);
  }

  entry.count += 1;

  return entry.count <= 10;
}
