import { createHash } from "node:crypto";
import type { Transaction } from "kysely";
import type { DB } from "./types.js";
import { hashPassword } from "../utils/password.js";

type SeedDb = Transaction<DB>;

// These keys are reserved for this seed. Existing rows are never updated.
function seedId(key: string) {
  const bytes = createHash("sha256").update(`clemora-demo-v1:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomSource(seed: string) {
  let state = createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  if (!items.length) throw new Error("Cannot choose from an empty seed set");
  return items[Math.floor(random() * items.length)]!;
}

function seedClock() {
  const value = process.env.SEED_CLOCK;
  if (!value) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new Error("SEED_CLOCK must be an ISO UTC timestamp, for example 2026-10-31T00:00:00Z");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("SEED_CLOCK is not a valid date");
  return date;
}

const users = [
  { key: "admin", email: "demo.admin@clemora.example.test", name: "Mara Santos", role: "admin", staffRole: "System Administrator" },
  { key: "ana", email: "demo.ana@clemora.example.test", name: "Ana Reyes", role: "customer", staffRole: null },
  { key: "ben", email: "demo.ben@clemora.example.test", name: "Ben Cruz", role: "customer", staffRole: null },
  { key: "camille", email: "demo.camille@clemora.example.test", name: "Camille Lim", role: "customer", staffRole: null },
  { key: "daniel", email: "demo.daniel@clemora.example.test", name: "Daniel Flores", role: "customer", staffRole: null },
  { key: "ella", email: "demo.ella@clemora.example.test", name: "Ella Navarro", role: "customer", staffRole: null },
] as const;

const services = [
  { key: "catering", name: "Demo Buffet Catering", description: "Buffet menu and service team for a private event.", categories: ["Catering"] },
  { key: "coordination", name: "Demo Event Coordination", description: "On-the-day event coordination and supplier handoff.", categories: ["Coordination"] },
  { key: "photo-booth", name: "Demo Photo Booth", description: "Two-hour photo booth with an attendant and digital copies.", categories: ["Entertainment", "Photography"] },
  { key: "audio", name: "Demo Audio and Lighting", description: "Basic sound system and event lighting with an operator.", categories: ["Production"] },
] as const;

const packages = [
  { key: "wedding", name: "Demo Wedding Reception", eventType: "Wedding", guestMin: 50, guestMax: 100, price: 12000000, description: "Sample reception for 50 to 100 guests with buffet catering and coordination." },
  { key: "birthday", name: "Demo Birthday Celebration", eventType: "Birthday", guestMin: 30, guestMax: 80, price: 6000000, description: "Sample birthday celebration for 30 to 80 guests with catering and coordination." },
  { key: "corporate", name: "Demo Corporate Gathering", eventType: "Corporate", guestMin: 30, guestMax: 100, price: 9000000, description: "Sample company gathering for 30 to 100 guests with catering and coordination." },
] as const;

const venues = [
  { key: "garden", name: "Demo Garden Pavilion", location: "Quezon City, Metro Manila", description: "Sample open-air venue draft with covered dining space. Availability has not been checked.", categories: ["Garden", "Outdoor"], capacityMin: 50, capacityMax: 100 },
  { key: "hall", name: "Demo City Function Hall", location: "Makati, Metro Manila", description: "Sample indoor venue draft for celebrations and company events. Availability has not been checked.", categories: ["Indoor", "Function Hall"], capacityMin: 30, capacityMax: 100 },
  { key: "terrace", name: "Demo Rooftop Terrace", location: "Taguig, Metro Manila", description: "Sample terrace venue draft for an evening event. Availability has not been checked.", categories: ["Rooftop"], capacityMin: 30, capacityMax: 80 },
] as const;

type UserKey = (typeof users)[number]["key"];
type PackageKey = (typeof packages)[number]["key"];

const scenarios: { key: string; customer: UserKey; package: PackageKey; status: string; outOfRange?: boolean; note: string }[] = [
  { key: "wedding-review", customer: "ana", package: "wedding", status: "under_review", note: "Please include a vegetarian meal option." },
  { key: "birthday-details", customer: "ben", package: "birthday", status: "needs_details", outOfRange: true, note: "We may have more guests than the package estimate." },
  { key: "corporate-accepted", customer: "camille", package: "corporate", status: "accepted", note: "Please share the projector requirements." },
  { key: "wedding-declined", customer: "daniel", package: "wedding", status: "declined", note: "We can move to another date if needed." },
  { key: "birthday-cancelled", customer: "ella", package: "birthday", status: "cancelled", note: "Family plans have changed." },
];

export async function seedDemo(db: SeedDb) {
  const now = seedClock();
  const random = randomSource(process.env.SEED_RANDOM_SEED ?? "clemora-demo-v1");
  const count = { users: 0, services: 0, packages: 0, venues: 0, assignments: 0, requests: 0, history: 0, conversations: 0, messages: 0 };
  const persistedUsers = new Map<UserKey, { id: string; role: string; staffRole: string | null; name: string }>();
  const persistedServices = new Map<string, { id: string; versionId: string; published: boolean }>();
  const persistedPackages = new Map<string, { id: string; versionId: string; name: string; eventType: string; guestMin: number; guestMax: number; published: boolean }>();

  for (const user of users) {
    const id = seedId(`user:${user.key}`);
    if (!(await db.selectFrom("users").select("id").where("id", "=", id).executeTakeFirst())) {
      const inserted = await db.insertInto("users").values({ id, email: user.email, display_name: user.name, role: user.role, staff_role: user.staffRole, password_hash: await hashPassword("p@ssword01"), created_at: now, updated_at: now })
        .onConflict((conflict) => conflict.doNothing()).returning("id").executeTakeFirst();
      if (inserted) count.users++;
    }
    const row = await db.selectFrom("users").select(["id", "role", "staff_role", "display_name"]).where("id", "=", id).executeTakeFirst();
    if (row) persistedUsers.set(user.key, { id: row.id, role: row.role, staffRole: row.staff_role, name: row.display_name ?? user.name });
  }

  for (const service of services) {
    const id = seedId(`service:${service.key}`);
    const inserted = await db.insertInto("services").values({ id, created_at: now, updated_at: now })
      .onConflict((conflict) => conflict.column("id").doNothing()).returning("id").executeTakeFirst();
    if (inserted) count.services++;
    const parent = await db.selectFrom("services").select(["id", "archived_at"]).where("id", "=", id).executeTakeFirstOrThrow();
    const versionId = seedId(`service-version:${service.key}:1`);
    await db.insertInto("service_versions").values({ id: versionId, service_id: parent.id, version: 1, state: "published", name: service.name, description: service.description, categories: [...service.categories], image_url: null, created_at: now, updated_at: now, published_at: now })
      .onConflict((conflict) => conflict.doNothing()).execute();
    const version = await db.selectFrom("service_versions").select(["id", "state"]).where("id", "=", versionId).where("service_id", "=", parent.id).executeTakeFirst();
    if (version) persistedServices.set(service.key, { id: parent.id, versionId: version.id, published: !parent.archived_at && version.state === "published" });
  }

  for (const pkg of packages) {
    const id = seedId(`package:${pkg.key}`);
    const inserted = await db.insertInto("packages").values({ id, created_at: now, updated_at: now })
      .onConflict((conflict) => conflict.column("id").doNothing()).returning("id").executeTakeFirst();
    if (inserted) count.packages++;
    const parent = await db.selectFrom("packages").select(["id", "archived_at"]).where("id", "=", id).executeTakeFirstOrThrow();
    const versionId = seedId(`package-version:${pkg.key}:1`);
    await db.insertInto("package_versions").values({ id: versionId, package_id: parent.id, version: 1, state: "published", name: pkg.name, event_types: [pkg.eventType], description: pkg.description, guest_min: pkg.guestMin, guest_max: pkg.guestMax, venue_details: "", inclusions: ["Buffet catering", "On-the-day event coordination"], exclusions: ["Optional add-ons", "Venue fees"], terms: "Demo offer only. Staff must confirm availability and final terms before making a commitment.", image_url: null, price_amount_minor: pkg.price, created_at: now, updated_at: now, published_at: now })
      .onConflict((conflict) => conflict.doNothing()).execute();
    const version = await db.selectFrom("package_versions").select(["id", "state", "name", "event_types", "guest_min", "guest_max"]).where("id", "=", versionId).where("package_id", "=", parent.id).executeTakeFirst();
    if (version) persistedPackages.set(pkg.key, { id: parent.id, versionId: version.id, name: version.name, eventType: version.event_types[0] ?? pkg.eventType, guestMin: version.guest_min, guestMax: version.guest_max, published: !parent.archived_at && version.state === "published" });
  }

  for (const venue of venues) {
    const publishedDescription = venue.description.replace("venue draft", "venue");
    const id = seedId(`venue:${venue.key}`);
    const inserted = await db.insertInto("venues").values({ id, created_at: now, updated_at: now })
      .onConflict((conflict) => conflict.column("id").doNothing()).returning("id").executeTakeFirst();
    if (inserted) count.venues++;
    const parent = await db.selectFrom("venues").select(["id", "archived_at", "updated_at"]).where("id", "=", id).executeTakeFirstOrThrow();
    if (parent.archived_at) continue;
    const versionId = seedId(`venue-version:${venue.key}:1`);
    const existing = await db.selectFrom("venue_versions").selectAll().where("id", "=", versionId).forUpdate().executeTakeFirst();
    if (!existing) {
      await db.insertInto("venue_versions").values({ id: versionId, venue_id: parent.id, version: 1, state: "published", name: venue.name, location: venue.location, description: publishedDescription, categories: [...venue.categories], capacity_min: venue.capacityMin, capacity_max: venue.capacityMax, created_at: now, updated_at: now, published_at: now })
        .onConflict((conflict) => conflict.doNothing()).execute();
      continue;
    }
    // Only upgrade the exact untouched draft created by the previous demo seed.
    if (existing.venue_id !== parent.id || existing.version !== 1 || existing.state !== "draft" || existing.published_at !== null ||
        existing.name !== venue.name || existing.location !== venue.location ||
        (existing.description !== venue.description && existing.description !== publishedDescription) ||
        existing.capacity_min !== venue.capacityMin || existing.capacity_max !== venue.capacityMax ||
        JSON.stringify(existing.categories) !== JSON.stringify(venue.categories) ||
        existing.updated_at.getTime() !== existing.created_at.getTime() ||
        existing.image_urls.length > 0) continue;
    const publishedAt = new Date(Math.max(now.getTime(), existing.updated_at.getTime() + 1, parent.updated_at.getTime() + 1));
    await db.updateTable("venue_versions").set({ state: "published", description: publishedDescription, published_at: publishedAt, updated_at: publishedAt }).where("id", "=", existing.id).execute();
    await db.updateTable("venues").set({ updated_at: publishedAt }).where("id", "=", parent.id).execute();
  }

  for (const pkg of packages) {
    const parent = persistedPackages.get(pkg.key);
    if (!parent?.published) continue;
    for (const [serviceKey, role, price] of [["catering", "included", null], ["coordination", "included", null], ["photo-booth", "add_on", 1500000], ["audio", "add_on", 1200000]] as const) {
      const service = persistedServices.get(serviceKey);
      if (!service?.published) continue;
      const inserted = await db.insertInto("package_services").values({ id: seedId(`package-service:${pkg.key}:${serviceKey}`), package_version_id: parent.versionId, service_version_id: service.versionId, role, included_quantity: role === "included" ? 1 : null, add_on_unit_price_amount_minor: price, add_on_max_quantity: role === "add_on" ? 2 : null })
        .onConflict((conflict) => conflict.doNothing()).returning("id").executeTakeFirst();
      if (inserted) count.assignments++;
    }
  }

  const eligiblePackages = [...persistedPackages.entries()].filter(([, pkg]) => pkg.published && pkg.guestMin >= 30 && pkg.guestMax <= 100 && pkg.guestMin <= pkg.guestMax);
  const eligibleCustomers = users.filter((user) => user.role === "customer" && persistedUsers.get(user.key)?.role === "customer");
  const randomScenarios = eligiblePackages.length && eligibleCustomers.length ? Array.from({ length: 5 }, (_, index) => {
    const [packageKey] = pick(eligiblePackages, random);
    const customer = pick(eligibleCustomers, random);
    return { key: `random-${index + 1}`, customer: customer.key, package: packageKey as PackageKey, status: "under_review", note: pick(["Please advise on vegetarian options.", "We would like a simple stage setup.", "Please confirm the preferred time slot."], random) };
  }) : [];

  for (const [index, scenario] of [...scenarios, ...randomScenarios].entries()) {
    const customer = persistedUsers.get(scenario.customer);
    const pkg = persistedPackages.get(scenario.package);
    const adminActor = persistedUsers.get("admin");
    if (!customer || customer.role !== "customer" || !pkg?.published) continue;
    if (!["under_review", "cancelled"].includes(scenario.status) && (adminActor?.role !== "admin" || adminActor.staffRole !== "System Administrator")) continue;
    const guestCount = "outOfRange" in scenario && scenario.outOfRange ? pkg.guestMax + 15 : pkg.guestMin + Math.floor(random() * (pkg.guestMax - pkg.guestMin + 1));
    const dayOffset = 30 + index * 7 + Math.floor(random() * 5);
    const startsAt = new Date(now.getTime() + dayOffset * 86400000);
    startsAt.setUTCHours(9 + Math.floor(random() * 6), 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 4 * 3600000);
    const id = seedId(`booking-request:${scenario.key}`);
    const reference = `DEMO-${String(index + 1).padStart(3, "0")}`;
    const inserted = await db.insertInto("booking_requests").values({ id, reference, customer_id: customer.id, package_id: pkg.id, package_version_id: pkg.versionId, package_name: pkg.name, event_type: pkg.eventType, preferred_date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(startsAt), estimated_duration: "4_hours", starts_at: startsAt, ends_at: endsAt, time_zone: "Asia/Manila", guest_count: guestCount, contact_name: customer.name, phone_number: "+63 917 555 0100", preferred_venue_location: pick(venues, random).location, special_requests: scenario.note, status: scenario.status, out_of_range: guestCount < pkg.guestMin || guestCount > pkg.guestMax, created_at: now, updated_at: now })
      .onConflict((conflict) => conflict.doNothing()).returning("id").executeTakeFirst();
    if (inserted) count.requests++;
    const request = await db.selectFrom("booking_requests").select(["id", "customer_id", "status"]).where("id", "=", id).executeTakeFirst();
    if (!request || request.customer_id !== customer.id) continue;
    const first = await db.insertInto("booking_request_status_history").values({ id: seedId(`booking-history:${scenario.key}:initial`), booking_request_id: request.id, status: "under_review", reason: null, changed_by: customer.id, created_at: now })
      .onConflict((conflict) => conflict.doNothing()).returning("id").executeTakeFirst();
    if (first) count.history++;
    if (scenario.status !== "under_review" && request.status === scenario.status) {
      const actor = scenario.status === "cancelled" ? customer : adminActor;
      if (actor && (scenario.status === "cancelled" || (actor.role === "admin" && actor.staffRole === "System Administrator"))) {
        const second = await db.insertInto("booking_request_status_history").values({ id: seedId(`booking-history:${scenario.key}:status`), booking_request_id: request.id, status: scenario.status, reason: scenario.status === "needs_details" ? "Please confirm the final guest count." : scenario.status === "declined" ? "Requested date is unavailable." : scenario.status === "cancelled" ? "Customer changed plans." : null, changed_by: actor.id, created_at: new Date(now.getTime() + 3600000) })
          .onConflict((conflict) => conflict.doNothing()).returning("id").executeTakeFirst();
        if (second) count.history++;
      }
    }
  }

  for (const user of users.filter((item) => item.role === "customer")) {
    const customer = persistedUsers.get(user.key);
    const admin = persistedUsers.get("admin");
    if (!customer || customer.role !== "customer" || !admin || admin.role !== "admin" || admin.staffRole !== "System Administrator") continue;
    const id = seedId(`conversation:${user.key}`);
    const inserted = await db.insertInto("conversations").values({ id, customer_id: customer.id, created_at: now, updated_at: now })
      .onConflict((conflict) => conflict.doNothing()).returning("id").executeTakeFirst();
    if (inserted) count.conversations++;
    const conversation = await db.selectFrom("conversations").select(["id", "customer_id"]).where("id", "=", id).executeTakeFirst();
    if (!conversation || conversation.customer_id !== customer.id) continue;
    const requested = scenarios.find((scenario) => scenario.customer === user.key);
    const subject = requested ? persistedPackages.get(requested.package)?.eventType.toLowerCase() : undefined;
    for (const [index, sender, body] of [[0, customer, `Hello, I would like to ask about a ${subject ?? "private"} event.`], [1, admin, "Thanks for reaching out. Please share your preferred date and guest count."]] as const) {
      const message = await db.insertInto("messages").values({ id: seedId(`message:${user.key}:${index}`), conversation_id: conversation.id, sender_id: sender.id, body, created_at: new Date(now.getTime() + index * 600000), read_at: index === 0 ? new Date(now.getTime() + 600000) : null })
        .onConflict((conflict) => conflict.doNothing()).returning("id").executeTakeFirst();
      if (message) count.messages++;
    }
  }

  return count;
}
