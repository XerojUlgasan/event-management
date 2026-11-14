import { catalogSlug } from "@event-management/contracts/catalog-slug";
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

const venues = [
  {
    id: "b1000000-0000-0000-0000-000000000001",
    name: "Sample Garden 01",
    location: "Demo location 01",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000002",
    name: "Sample Hall 02",
    location: "Demo location 02",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000003",
    name: "Sample Pavilion 03",
    location: "Demo location 03",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000004",
    name: "Sample Terrace 04",
    location: "Demo location 04",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000005",
    name: "Sample Ballroom 05",
    location: "Demo location 05",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000006",
    name: "Sample Courtyard 06",
    location: "Demo location 06",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000007",
    name: "Sample Lounge 07",
    location: "Demo location 07",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000008",
    name: "Sample Riverside 08",
    location: "Demo location 08",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000009",
    name: "Sample Orchard 09",
    location: "Demo location 09",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000010",
    name: "Sample Beach 10",
    location: "Demo location 10",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000011",
    name: "Sample Convention Hall 11",
    location: "Demo location 11",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000012",
    name: "Sample Studio 12",
    location: "Demo location 12",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000013",
    name: "Sample Loft 13",
    location: "Demo location 13",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000014",
    name: "Sample Grand Hall 14",
    location: "Demo location 14",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
  {
    id: "b1000000-0000-0000-0000-000000000015",
    name: "Sample Hotel 15",
    location: "Demo location 15",
    description:
      "Synthetic venue for demonstration only. Confirm venue details and availability separately.",
  },
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
    let venueCount = 0;
    for (const venue of venues) {
      const inserted = await db
        .insertInto("venues")
        .values({
          ...venue,
          slug: catalogSlug(venue.name),
          max_guests: null,
          archived_at: new Date(),
        })
        .onConflict((conflict) => conflict.column("id").doNothing())
        .returning("id")
        .executeTakeFirst();
      if (inserted) venueCount++;
    }
    const demo = await seedDemo(db, passwordHash);
    const scenario = await seedScenario(db, passwordHash);
    return { accounts: rows, packageCount, venueCount, demo, scenario };
  });
  console.table(
    seeded.accounts.map(({ email, role, staff_role }) => ({
      email,
      role,
      staff_role,
    })),
  );
  console.log(
    `Inserted ${seeded.accounts.length} local accounts, ${seeded.packageCount} sample canvas packages, and ${seeded.venueCount} venues.`,
  );
  console.log("Inserted connected demo rows:", seeded.demo);
  console.log("Inserted scenario rows:", seeded.scenario);
} finally {
  await db.destroy();
}
