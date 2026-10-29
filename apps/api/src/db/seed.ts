import "dotenv/config";
import { sql } from "kysely";
import { db } from "./client.js";
import { hashPassword } from "../utils/password.js";

const legacyAccounts = [
  { email: "admin1@gmail.com", display_name: "System Admin", role: "admin", staff_role: "System Administrator" },
  ...Array.from({ length: 5 }, (_, i) => ({ email: `user${i + 1}@gmail.com`, display_name: `User ${i + 1}`, role: "customer", staff_role: null })),
];
const demoAccounts = [
  ...["Event Coordinator", "Event Coordinator", "Head Waiter", "Waiter", "Waiter", "Waiter", "Graphic Designer", "Photographer", "Host", "Catering Supervisor"].map((staff_role, i) => ({ email: `staff${i + 1}@example.test`, display_name: `Demo Staff ${i + 1}`, role: "staff", staff_role })),
  ...Array.from({ length: 10 }, (_, i) => ({ email: `customer${i + 1}@example.test`, display_name: `Demo Customer ${i + 1}`, role: "customer", staff_role: null })),
];

const venues = [
  { id: "b1000000-0000-0000-0000-000000000001", name: "Fernwood Gardens", location: "Quezon City", description: "A lush garden estate tucked in the heart of Quezon City, Fernwood Gardens offers sweeping lawns and elegant pavilions ideal for intimate to medium-sized receptions. The venue features open-air garden spaces and enclosed halls, accommodating a seamless indoor-outdoor flow. Clemora coordinates setup access from 6 AM, with dedicated loading bays and an on-site events manager." },
  { id: "b1000000-0000-0000-0000-000000000002", name: "Palazzo Verde", location: "Las Piñas City", description: "Inspired by baroque European architecture, Palazzo Verde is a grand estate venue in Las Piñas featuring dramatic fountains, manicured hedgerows, and ornate function halls. The property supports large-scale events with multiple event spaces and a sprawling courtyard. Clemora handles full logistics coordination with the venue's resident event team." },
  { id: "b1000000-0000-0000-0000-000000000003", name: "Hillcreek Gardens", location: "Tagaytay City", description: "Perched on a hillside in Tagaytay, Hillcreek Gardens offers cool mountain air and panoramic greenery as a natural backdrop. The venue suits intimate gatherings with its terraced garden spaces and rustic chapel. Clemora coordinates guest transport from Manila, on-site catering logistics, and venue access starting at 8 AM." },
  { id: "b1000000-0000-0000-0000-000000000004", name: "Taal Vista Hotel", location: "Tagaytay City", description: "A heritage hotel overlooking Taal Lake and Volcano, Taal Vista offers elegant ballrooms and al fresco terraces with one of the most dramatic views in Luzon. Its Grand Ballroom accommodates large formal events while the terrace suits cocktail receptions. Clemora works with the hotel's in-house team for catering and décor coordination." },
  { id: "b1000000-0000-0000-0000-000000000005", name: "The Manila Hotel Fiesta Pavilion", location: "Manila", description: "The iconic Manila Hotel's Fiesta Pavilion is a heritage grand ballroom in the heart of Manila, steeped in history and fitted with classic chandeliers and high ceilings. The space is ideal for formal receptions and gala dinners. Clemora coordinates with the hotel's dedicated events division for setup, catering, and décor timelines." },
  { id: "b1000000-0000-0000-0000-000000000006", name: "Halo Halo Garden", location: "Antipolo City", description: "A colorful open-air garden venue in Antipolo, Halo Halo Garden features vibrant tropical landscaping and flexible event spaces suited for festive celebrations. The venue has multiple function areas and a dedicated stage. Clemora manages tent logistics, catering layout, and guest reception setup at this property." },
  { id: "b1000000-0000-0000-0000-000000000007", name: "Kingsborough Events Place", location: "Quezon City", description: "A modern function hall in Quezon City, Kingsborough Events Place offers climate-controlled spaces with contemporary interiors and full AV support. The venue is flexible for both social and semi-formal events. Clemora handles full room setup, supplier coordination, and day-of operations at Kingsborough." },
  { id: "b1000000-0000-0000-0000-000000000008", name: "Riverbend", location: "Marikina City", description: "Set beside the Marikina River, Riverbend is a riverside garden venue with open pavilions, tree-lined pathways, and a tranquil water view. The property supports both garden ceremonies and indoor receptions. Clemora coordinates early access for setup, river-facing décor installation, and guest arrival logistics." },
  { id: "b1000000-0000-0000-0000-000000000009", name: "The Farm at San Benito", location: "Lipa, Batangas", description: "A luxury eco-wellness resort in Lipa, The Farm at San Benito offers lush tropical gardens, open-air event pavilions, and world-class facilities in a serene natural setting. The venue is ideal for intimate premium celebrations. Clemora coordinates guest transfers from Metro Manila, overnight accommodation, and curated event experiences with the resort team." },
  { id: "b1000000-0000-0000-0000-000000000010", name: "Thunderbird Resorts Poro Point", location: "La Union", description: "A beachfront resort in La Union, Thunderbird Resorts Poro Point offers stunning sea views, open-air event lawns, and fully equipped function rooms for destination events. Clemora manages full destination event logistics including guest travel, accommodation, beachside setup, and catering coordination with the resort." },
  { id: "b1000000-0000-0000-0000-000000000011", name: "Metrotent Convention Center", location: "Pasig City", description: "One of Metro Manila's premier convention venues, Metrotent in Pasig City offers expansive column-free halls ideal for large corporate gatherings, product launches, and gala dinners. The venue provides full AV infrastructure and loading dock access. Clemora coordinates multi-supplier logistics, floor planning, and day-of event operations." },
  { id: "b1000000-0000-0000-0000-000000000012", name: "Orchid Hall", location: "Pasig City", description: "A well-established function hall in Pasig City, Orchid Hall features elegant interiors, a dedicated stage, and flexible room configurations for corporate and social events. The venue comfortably hosts seated dinners and cocktail receptions. Clemora handles full event design, catering coordination, and supplier management at Orchid Hall." },
  { id: "b1000000-0000-0000-0000-000000000013", name: "Foundry Loft", location: "BGC, Taguig", description: "An industrial-chic event loft in Bonifacio Global City, Foundry Loft features exposed concrete, high ceilings, and versatile open-plan spaces ideal for modern corporate events and creative launches. The venue is centrally located in BGC with ample parking. Clemora manages AV setup, catering logistics, and branding installation at Foundry Loft." },
  { id: "b1000000-0000-0000-0000-000000000014", name: "Solaire Grand Ballroom", location: "Parañaque City", description: "Located inside Solaire Resort and Casino in Entertainment City, the Grand Ballroom is a world-class luxury venue with high-gloss interiors, state-of-the-art lighting, and a capacity for grand-scale events. The venue offers full hotel amenities and in-house catering. Clemora works with Solaire's dedicated events team for seamless high-end event delivery." },
  { id: "b1000000-0000-0000-0000-000000000015", name: "The Peninsula Manila", location: "Makati City", description: "The Peninsula Manila in Ayala Avenue is one of the Philippines' most prestigious luxury hotels, offering iconic ballrooms and private function rooms with impeccable service. Ideal for corporate galas, premium receptions, and high-profile events. Clemora coordinates with The Peninsula's in-house events team for catering, décor, and full-day event management." },
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
    let venueCount = 0;
    for (const venue of venues) {
      const inserted = await db
        .insertInto("venues")
        .values({ id: venue.id, name: venue.name, location: venue.location, description: venue.description })
        .onConflict((conflict) => conflict.column("id").doUpdateSet({
          name: venue.name, location: venue.location, description: venue.description, archived_at: null,
        }))
        .returning("id")
        .executeTakeFirst();
      if (inserted) venueCount++;
    }
    return { accounts: rows, packageCount, upgradedCount, venueCount };
  });
  console.table(seeded.accounts.map(({ email, role, staff_role }) => ({ email, role, staff_role })));
  console.log(`Seeded ${seeded.accounts.length} local accounts, ${seeded.packageCount} sample package drafts (upgraded ${seeded.upgradedCount}), and ${seeded.venueCount} venues.`);
} finally {
  await db.destroy();
}
