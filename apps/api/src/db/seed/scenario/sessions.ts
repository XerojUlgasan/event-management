import { randomBytes } from "node:crypto";
import { hashSessionToken, SESSION_TTL_MS } from "../../../utils/session.js";
import type { SeedDb } from "../context.js";
import { expectCount, insertIfNew, scenarioId } from "../context.js";
import type { ScenarioUser } from "./users.js";

export type ScenarioSession = { id: string; userId: string; expiresAt: Date };

export function planScenarioSessions(users: ScenarioUser[], now: Date): ScenarioSession[] {
  const sessions = users.map((user, index) => ({
    id: scenarioId(`session:${index}`),
    userId: user.id,
    expiresAt: index % 5 === 0 ? new Date(now.getTime() - 86_400_000) : new Date(now.getTime() + SESSION_TTL_MS),
  }));
  expectCount("sessions", sessions.length);
  return sessions;
}

export async function seedScenarioSessions(db: SeedDb, input: { sessions: ScenarioSession[]; now: Date }) {
  let inserted = 0;
  for (const session of input.sessions) {
    const created = await insertIfNew(db, "sessions", {
      id: session.id,
      user_id: session.userId,
      token_hash: hashSessionToken(randomBytes(32).toString("hex")),
      expires_at: session.expiresAt,
      created_at: input.now,
    });
    if (created) inserted += 1;
  }
  return { sessions: input.sessions, inserted };
}
