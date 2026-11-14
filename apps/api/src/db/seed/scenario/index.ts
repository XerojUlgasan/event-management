import type { SeedDb } from "../context.js";
import { seedClock, seedRandom } from "../context.js";
import { planScenarioActivity, seedScenarioActivity } from "./activity.js";
import { planScenarioCatalog, seedScenarioCatalog } from "./catalog.js";
import { seedScenarioQuotations } from "./quotations.js";
import { planScenarioSessions, seedScenarioSessions } from "./sessions.js";
import { planScenarioUsers, seedScenarioUsers } from "./users.js";

/** Required defaults stay in seed.ts. This module adds the optional interconnected scenario. */
export async function seedScenario(db: SeedDb, passwordHash: string) {
  const now = seedClock();
  const users = planScenarioUsers();
  const persistedUsers = await seedScenarioUsers(db, {
    users,
    passwordHash,
    now,
  });
  const sessions = await seedScenarioSessions(db, {
    sessions: planScenarioSessions(persistedUsers.users, now),
    now,
  });
  const catalog = await seedScenarioCatalog(db, {
    catalog: planScenarioCatalog(),
    users: persistedUsers.users,
    now,
  });
  const activity = await seedScenarioActivity(db, {
    plan: planScenarioActivity({
      users: persistedUsers.users,
      packages: catalog.packages,
      now,
      random: seedRandom(),
    }),
    users: persistedUsers.users,
    packages: catalog.packages,
    now,
  });
  const quotations = await seedScenarioQuotations(db, {
    bookings: activity.bookings,
    users: persistedUsers.users,
    now,
  });
  return {
    users: persistedUsers.inserted,
    sessions: sessions.inserted,
    ...catalog.inserted,
    ...activity.inserted,
    ...quotations.inserted,
  };
}
