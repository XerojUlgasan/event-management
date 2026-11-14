import type { SeedDb } from "../context.js";
import {
  expectCount,
  insertIfNew,
  SCENARIO_COUNT,
  scenarioId,
  scenarioIndex,
} from "../context.js";

const STAFF_ROLES = [
  "Event Coordinator",
  "Head Waiter",
  "Waiter",
  "Graphic Designer",
  "Photographer",
  "Host",
  "Catering Supervisor",
] as const;
const GIVEN_NAMES = [
  "Amina",
  "Paolo",
  "Rafael",
  "Sofia",
  "Miguel",
  "Isabel",
  "Andres",
  "Camila",
  "Luis",
  "Elena",
  "Marco",
  "Diana",
  "Carlo",
  "Bea",
  "Nico",
  "Lara",
  "Hugo",
  "Pia",
  "Enzo",
  "Rosa",
];
const FAMILY_NAMES = [
  "Santos",
  "Reyes",
  "Cruz",
  "Garcia",
  "Flores",
  "Torres",
  "Ramos",
  "Navarro",
  "Castillo",
  "Morales",
  "Gutierrez",
  "Aguilar",
  "Domingo",
  "Villanueva",
  "Castro",
  "Fernandez",
  "Mendoza",
  "Silva",
  "Ortega",
  "Del Rosario",
];

export type ScenarioUser = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "staff" | "customer";
  staffRole: string | null;
};

function roleFor(index: number): Pick<ScenarioUser, "role" | "staffRole"> {
  if (index < 4) return { role: "admin", staffRole: "System Administrator" };
  if (index < 28)
    return {
      role: "staff",
      staffRole: STAFF_ROLES[(index - 4) % STAFF_ROLES.length] ?? "Waiter",
    };
  return { role: "customer", staffRole: null };
}

export function planScenarioUsers(): ScenarioUser[] {
  const users = Array.from(
    { length: SCENARIO_COUNT },
    (_, index): ScenarioUser => {
      const given = GIVEN_NAMES[index % GIVEN_NAMES.length] ?? "Guest";
      const family = FAMILY_NAMES[index % FAMILY_NAMES.length] ?? "Sample";
      const role = roleFor(index);
      return {
        id: scenarioId(`user:${index}`),
        email: `scenario.user${scenarioIndex(index)}@clemora.example.test`,
        displayName: `${given} ${family}`,
        role: role.role,
        staffRole: role.staffRole,
      };
    },
  );
  expectCount("users", users.length);
  return users;
}

export async function seedScenarioUsers(
  db: SeedDb,
  input: { users: ScenarioUser[]; passwordHash: string; now: Date },
) {
  let inserted = 0;
  for (const user of input.users) {
    const created = await insertIfNew(db, "users", {
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      role: user.role,
      staff_role: user.staffRole,
      password_hash: input.passwordHash,
      created_at: input.now,
      updated_at: input.now,
    });
    if (created) inserted += 1;
  }
  return { users: input.users, inserted };
}
