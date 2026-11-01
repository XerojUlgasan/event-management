import "dotenv/config";
import { sql } from "kysely";
import { db } from "./client.js";
import { hashPassword } from "../utils/password.js";
import { seedDemo } from "./seed-demo.js";

const legacyAccounts = [
  { email: "admin1@gmail.com", display_name: "System Admin", role: "admin", staff_role: "System Administrator" },
  ...Array.from({ length: 5 }, (_, i) => ({ email: `user${i + 1}@gmail.com`, display_name: `User ${i + 1}`, role: "customer", staff_role: null })),
];
const demoAccounts = [
  ...["Event Coordinator", "Event Coordinator", "Head Waiter", "Waiter", "Waiter", "Waiter", "Graphic Designer", "Photographer", "Host", "Catering Supervisor"].map((staff_role, i) => ({ email: `staff${i + 1}@example.test`, display_name: `Demo Staff ${i + 1}`, role: "staff", staff_role })),
  ...Array.from({ length: 10 }, (_, i) => ({ email: `customer${i + 1}@example.test`, display_name: `Demo Customer ${i + 1}`, role: "customer", staff_role: null })),
];

const venues = [
  { id: "b1000000-0000-0000-0000-000000000001", name: "Sample Garden 01", location: "Demo location 01", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000002", name: "Sample Hall 02", location: "Demo location 02", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000003", name: "Sample Pavilion 03", location: "Demo location 03", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000004", name: "Sample Terrace 04", location: "Demo location 04", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000005", name: "Sample Ballroom 05", location: "Demo location 05", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000006", name: "Sample Courtyard 06", location: "Demo location 06", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000007", name: "Sample Lounge 07", location: "Demo location 07", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000008", name: "Sample Riverside 08", location: "Demo location 08", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000009", name: "Sample Orchard 09", location: "Demo location 09", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000010", name: "Sample Beach 10", location: "Demo location 10", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000011", name: "Sample Convention Hall 11", location: "Demo location 11", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000012", name: "Sample Studio 12", location: "Demo location 12", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000013", name: "Sample Loft 13", location: "Demo location 13", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000014", name: "Sample Grand Hall 14", location: "Demo location 14", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
  { id: "b1000000-0000-0000-0000-000000000015", name: "Sample Hotel 15", location: "Demo location 15", description: "Synthetic venue for demonstration only. Confirm venue details and availability separately." },
];

const legacyDescription = "Sample draft. Replace these details with an approved offer before publishing.";
const packages = [
  {
    id: "a4e55db2-745b-4bdb-bf92-38e7d29261d1", name: "Sample Wedding Package", eventTypes: ["Wedding"],
    description: "Demo wedding reception package with a fixed sample total for up to 100 guests.",
    guestMax: 100,
    inclusions: ["Sample reception setup", "Sample buffet catering"],
    exclusions: ["Optional add-ons and extra venue hours"], price: 120000,
  },
  {
    id: "a4e55db2-745b-4bdb-bf92-38e7d29261d2", name: "Sample Birthday Package", eventTypes: ["Birthday"],
    description: "Demo birthday celebration package with a fixed sample total for up to 80 guests.",
    guestMax: 80,
    inclusions: ["Sample party setup", "Sample buffet catering"],
    exclusions: ["Optional add-ons and extra venue hours"], price: 60000,
  },
  {
    id: "a4e55db2-745b-4bdb-bf92-38e7d29261d3", name: "Sample Corporate Package", eventTypes: ["Corporate"],
    description: "Demo corporate gathering package with a fixed sample total for up to 100 guests.",
    guestMax: 100,
    inclusions: ["Sample event setup", "Sample buffet catering"],
    exclusions: ["Optional add-ons and extra venue hours"], price: 90000,
  },
];

try {
  const seeded = await db.transaction().execute(async (db) => {
    const rows = [];
    // Fixture addresses are insert-only: a pre-existing account is never claimed.
    for (const account of [...legacyAccounts, ...demoAccounts]) {
      const row = await db.insertInto("users").values({ ...account, password_hash: await hashPassword("p@ssword01") })
        .onConflict((conflict) => conflict.expression(sql`lower(trim(email))`).doNothing())
        .returning(["id", "email", "role", "staff_role"]).executeTakeFirst();
      if (row) rows.push(row);
    }
    let packageCount = 0;
    let upgradedCount = 0;
    for (const pkg of packages) {
      const content = {
        name: pkg.name,
        event_types: pkg.eventTypes,
        description: pkg.description,
        guest_max: pkg.guestMax,
        inclusions: pkg.inclusions,
        exclusions: pkg.exclusions,
        image_url: null,
        price: pkg.price,
      };
      const inserted = await db
        .insertInto("packages")
        .values({ id: pkg.id })
        .onConflict((conflict) => conflict.column("id").doNothing())
        .returning("id")
        .executeTakeFirst();
      if (inserted) {
        await db.insertInto("package_versions").values({
          package_id: pkg.id, version: 1, state: "draft", ...content,
        }).execute();
        packageCount++;
        continue;
      }
      const existing = await db.selectFrom("package_versions").selectAll()
        .where("package_id", "=", pkg.id).where("version", "=", 1).forUpdate().executeTakeFirst();
      if (existing?.state !== "draft" || existing.name !== pkg.name ||
          existing.event_types.length !== 1 || existing.event_types[0] !== pkg.eventTypes[0] ||
          existing.description !== legacyDescription || existing.guest_max !== 100 ||
          existing.inclusions.length !== 0 || existing.exclusions.length !== 0 ||
          existing.image_url !== null || existing.price !== null) continue;
      const updated = await db.updateTable("package_versions").set({ ...content, updated_at: new Date() })
        .where("id", "=", existing.id).returning("id").executeTakeFirst();
      if (updated) upgradedCount++;
    }
    let venueCount = 0;
    for (const venue of venues) {
      const inserted = await db
        .insertInto("venues")
        .values({ id: venue.id })
        .onConflict((conflict) => conflict.column("id").doNothing())
        .returning("id")
        .executeTakeFirst();
      if (inserted) {
        await db.insertInto("venue_versions").values({ venue_id: venue.id, version: 1, state: "draft", name: venue.name, location: venue.location, description: venue.description, categories: [], capacity_max: null }).execute();
        venueCount++;
      }
    }
    const demo = await seedDemo(db);
    return { accounts: rows, packageCount, upgradedCount, venueCount, demo };
  });
  console.table(seeded.accounts.map(({ email, role, staff_role }) => ({ email, role, staff_role })));
  console.log(`Inserted ${seeded.accounts.length} local accounts, ${seeded.packageCount} sample package drafts (upgraded ${seeded.upgradedCount}), and ${seeded.venueCount} venues.`);
  console.log("Inserted connected demo rows:", seeded.demo);
} finally {
  await db.destroy();
}
