import "dotenv/config";
import { sql } from "kysely";
import { db } from "./client.js";
import { hashPassword } from "../lib/password.js";

const accounts = [
  { email: "admin1@gmail.com", display_name: "Admin 1", role: "admin" },
  ...Array.from({ length: 5 }, (_, index) => ({
    email: `user${index + 1}@gmail.com`,
    display_name: `User ${index + 1}`,
    role: "customer",
  })),
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
        .returning(["id", "email", "role"])
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
  console.table(seeded.accounts.map(({ email, role }) => ({ email, role })));
  console.log(`Seeded ${seeded.accounts.length} local accounts and ${seeded.packageCount} publishable sample package drafts; upgraded ${seeded.upgradedCount} untouched older drafts.`);
} finally {
  await db.destroy();
}
