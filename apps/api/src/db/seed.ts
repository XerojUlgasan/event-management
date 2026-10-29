import "dotenv/config";
import { sql } from "kysely";
import { db } from "./client.js";
import { hashPassword } from "../utils/password.js";

const accounts = [
  // System admin
  { email: "admin1@gmail.com",           display_name: "System Admin",    role: "admin", staff_role: "System Administrator" },
  // Staff (admin)
  { email: "marcos.reyes@clemora.com",    display_name: "Marcos Reyes",    role: "admin", staff_role: "Event Coordinator" },
  { email: "isabelle.santos@clemora.com", display_name: "Isabelle Santos", role: "admin", staff_role: "Event Coordinator" },
  { email: "daniel.cruz@clemora.com",     display_name: "Daniel Cruz",     role: "admin", staff_role: "Head Waiter" },
  { email: "patricia.lim@clemora.com",    display_name: "Patricia Lim",    role: "admin", staff_role: "Waiter" },
  { email: "jose.torres@clemora.com",     display_name: "Jose Torres",     role: "admin", staff_role: "Waiter" },
  { email: "angela.rivera@clemora.com",   display_name: "Angela Rivera",   role: "admin", staff_role: "Waiter" },
  { email: "rafael.mendoza@clemora.com",  display_name: "Rafael Mendoza",  role: "admin", staff_role: "Graphic Designer" },
  { email: "clara.navarro@clemora.com",   display_name: "Clara Navarro",   role: "admin", staff_role: "Photographer" },
  { email: "miguel.bautista@clemora.com", display_name: "Miguel Bautista", role: "admin", staff_role: "Host" },
  { email: "diana.flores@clemora.com",    display_name: "Diana Flores",    role: "admin", staff_role: "Catering Supervisor" },
  // Customers
  { email: "james.ochoa@gmail.com",       display_name: "James Ochoa",     role: "customer", staff_role: null },
  { email: "sophia.reyes@gmail.com",      display_name: "Sophia Reyes",    role: "customer", staff_role: null },
  { email: "nathan.garcia@gmail.com",     display_name: "Nathan Garcia",   role: "customer", staff_role: null },
  { email: "emily.dela.cruz@gmail.com",   display_name: "Emily Dela Cruz", role: "customer", staff_role: null },
  { email: "aaron.villanueva@gmail.com",  display_name: "Aaron Villanueva",role: "customer", staff_role: null },
  { email: "mia.santos@gmail.com",        display_name: "Mia Santos",      role: "customer", staff_role: null },
  { email: "carlos.ramos@gmail.com",      display_name: "Carlos Ramos",    role: "customer", staff_role: null },
  { email: "grace.aquino@gmail.com",      display_name: "Grace Aquino",    role: "customer", staff_role: null },
  { email: "luis.fernandez@gmail.com",    display_name: "Luis Fernandez",  role: "customer", staff_role: null },
  { email: "jasmine.catalan@gmail.com",   display_name: "Jasmine Catalan", role: "customer", staff_role: null },
];

const legacyDescription = "Sample draft. Replace these details with an approved offer before publishing.";
const sampleTerms = "Demo data only. Staff must approve the offer and confirm availability before using it for a customer.";
const packages = [
  {
    id: "a4e55db2-745b-4bdb-bf92-38e7d29261d1", name: "Sample Wedding Package", eventTypes: ["Wedding"],
    description: "Demo wedding reception package with a fixed sample total for 50 to 100 guests.",
    guestMin: 50, guestMax: 100, venueDetails: "Sample reception venue; staff must confirm the actual venue and date.",
    inclusions: ["Sample reception setup", "Sample buffet catering"],
    exclusions: ["Optional add-ons and extra venue hours"], priceAmountMinor: 12000000,
  },
  {
    id: "a4e55db2-745b-4bdb-bf92-38e7d29261d2", name: "Sample Birthday Package", eventTypes: ["Birthday"],
    description: "Demo birthday celebration package with a fixed sample total for 30 to 80 guests.",
    guestMin: 30, guestMax: 80, venueDetails: "Sample celebration venue; staff must confirm the actual venue and date.",
    inclusions: ["Sample party setup", "Sample buffet catering"],
    exclusions: ["Optional add-ons and extra venue hours"], priceAmountMinor: 6000000,
  },
  {
    id: "a4e55db2-745b-4bdb-bf92-38e7d29261d3", name: "Sample Corporate Package", eventTypes: ["Corporate"],
    description: "Demo corporate gathering package with a fixed sample total for 30 to 100 guests.",
    guestMin: 30, guestMax: 100, venueDetails: "Sample event venue; staff must confirm the actual venue and date.",
    inclusions: ["Sample event setup", "Sample buffet catering"],
    exclusions: ["Optional add-ons and extra venue hours"], priceAmountMinor: 9000000,
  },
];

try {
  const seeded = await db.transaction().execute(async (db) => {
    const rows = [];
    for (const account of accounts) {
      const values = {
        ...account,
        password_hash: await hashPassword("p@ssword01"),
      };
      const row = await db
        .insertInto("users")
        .values(values)
        .onConflict((conflict) =>
          conflict
            .expression(sql`lower(trim(email))`)
            .doUpdateSet({ ...values, updated_at: new Date() }),
        )
        .returning(["id", "email", "role", "staff_role"])
        .executeTakeFirstOrThrow();
      rows.push(row);
    }
    // Password resets invalidate previous sessions for these demo accounts only.
    await db
      .deleteFrom("sessions")
      .where(
        "user_id",
        "in",
        rows.map((row) => row.id),
      )
      .execute();
    let packageCount = 0;
    let upgradedCount = 0;
    for (const pkg of packages) {
      const content = {
        name: pkg.name,
        event_types: pkg.eventTypes,
        description: pkg.description,
        guest_min: pkg.guestMin,
        guest_max: pkg.guestMax,
        venue_details: pkg.venueDetails,
        inclusions: pkg.inclusions,
        exclusions: pkg.exclusions,
        terms: sampleTerms,
        image_url: null,
        price_amount_minor: pkg.priceAmountMinor,
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
          existing.description !== legacyDescription || existing.guest_min !== 30 || existing.guest_max !== 100 ||
          existing.venue_details !== "" || existing.inclusions.length !== 0 || existing.exclusions.length !== 0 ||
          existing.terms !== "" || existing.image_url !== null || existing.price_amount_minor !== null) continue;
      const updated = await db.updateTable("package_versions").set({ ...content, updated_at: new Date() })
        .where("id", "=", existing.id).returning("id").executeTakeFirst();
      if (updated) upgradedCount++;
    }
    return { accounts: rows, packageCount, upgradedCount };
  });
  console.table(seeded.accounts.map(({ email, role, staff_role }) => ({ email, role, staff_role })));
  console.log(`Seeded ${seeded.accounts.length} local accounts and ${seeded.packageCount} publishable sample package drafts; upgraded ${seeded.upgradedCount} untouched older drafts.`);
} finally {
  await db.destroy();
}
