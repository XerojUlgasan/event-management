import type { FirebaseUser } from "../../types/hono.js";

export function recentlyAuthenticated(firebase: FirebaseUser) {
  return (
    Number.isFinite(firebase.authTime) &&
    Math.abs(Date.now() / 1000 - firebase.authTime) <= 300
  );
}
