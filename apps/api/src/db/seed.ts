import "dotenv/config";
import { sql } from "kysely";
import { db } from "./client.js";
import { hashPassword } from "../utils/password.js";
import { LOCAL_PASSWORD } from "./seed/context.js";
import { seedScenario } from "./seed/scenario/index.js";
import { seedDemo } from "./seed-demo.js";
import { seedSamplePackages } from "./seed-packages.js";

const legacyAccounts = [
  {
    email: "admin1@gmail.com",
    display_name: "System Admin",
    role: "admin",
    staff_role: "System Administrator",
  },
  ...Array.from({ length: 5 }, (_, i) => ({
    email: `user${i + 1}@gmail.com`,
    display_name: `User ${i + 1}`,
    role: "customer",
    staff_role: null,
  })),
];
const demoAccounts = [
  ...[
    "Event Coordinator",
    "Event Coordinator",
    "Head Waiter",
    "Waiter",
    "Waiter",
    "Waiter",
    "Graphic Designer",
    "Photographer",
    "Host",
    "Catering Supervisor",
  ].map((staff_role, i) => ({
    email: `staff${i + 1}@example.test`,
    display_name: `Demo Staff ${i + 1}`,
    role: "staff",
    staff_role,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    email: `customer${i + 1}@example.test`,
    display_name: `Demo Customer ${i + 1}`,
    role: "customer",
    staff_role: null,
  })),
];

try {
  const passwordHash = await hashPassword(LOCAL_PASSWORD);
  const seeded = await db.transaction().execute(async (db) => {
    const rows = [];
    // Fixture addresses are insert-only: a pre-existing account is never claimed.
    for (const account of [...legacyAccounts, ...demoAccounts]) {
      const row = await db
        .insertInto("users")
        .values({ ...account, password_hash: passwordHash })
        .onConflict((conflict) =>
          conflict.expression(sql`lower(trim(email))`).doNothing(),
        )
        .returning(["id", "email", "role", "staff_role"])
        .executeTakeFirst();
      if (row) rows.push(row);
    }
    const packageCount = await seedSamplePackages(db);
    const demo = await seedDemo(db, passwordHash);
    const scenario = await seedScenario(db, passwordHash);
    return { accounts: rows, packageCount, demo, scenario };
  });
  console.table(
    seeded.accounts.map(({ email, role, staff_role }) => ({
      email,
      role,
      staff_role,
    })),
  );
  console.log(
    `Inserted ${seeded.accounts.length} local accounts and ${seeded.packageCount} sample canvas packages.`,
  );
  console.log("Inserted connected demo rows:", seeded.demo);
  console.log("Inserted scenario rows:", seeded.scenario);
} finally {
  await db.destroy();
}
