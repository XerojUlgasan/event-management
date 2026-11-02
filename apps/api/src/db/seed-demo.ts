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

const venues = [
  { key: "garden", name: "Demo Garden Pavilion", location: "Quezon City, Metro Manila", description: "Sample open-air venue draft with covered dining space. Availability has not been checked.", categories: ["Garden", "Outdoor"], capacityMax: 100 },
  { key: "hall", name: "Demo City Function Hall", location: "Makati, Metro Manila", description: "Sample indoor venue draft for celebrations and company events. Availability has not been checked.", categories: ["Indoor", "Function Hall"], capacityMax: 100 },
  { key: "terrace", name: "Demo Rooftop Terrace", location: "Taguig, Metro Manila", description: "Sample terrace venue draft for an evening event. Availability has not been checked.", categories: ["Rooftop"], capacityMax: 80 },
] as const;

type UserKey = (typeof users)[number]["key"];
export async function seedDemo(db: SeedDb) {
  const now = seedClock();
  const count = { users: 0, services: 0, packages: 0, venues: 0, assignments: 0, requests: 0, history: 0, conversations: 0, messages: 0 };
  const persistedUsers = new Map<UserKey, { id: string; role: string; staffRole: string | null; name: string }>();

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
      await db.insertInto("venue_versions").values({ id: versionId, venue_id: parent.id, version: 1, state: "published", name: venue.name, location: venue.location, description: publishedDescription, categories: [...venue.categories], capacity_max: venue.capacityMax, created_at: now, updated_at: now, published_at: now })
        .onConflict((conflict) => conflict.doNothing()).execute();
      continue;
    }
    // Only upgrade the exact untouched draft created by the previous demo seed.
    if (existing.venue_id !== parent.id || existing.version !== 1 || existing.state !== "draft" || existing.published_at !== null ||
        existing.name !== venue.name || existing.location !== venue.location ||
        (existing.description !== venue.description && existing.description !== publishedDescription) ||
        existing.capacity_max !== venue.capacityMax ||
        JSON.stringify(existing.categories) !== JSON.stringify(venue.categories) ||
        existing.updated_at.getTime() !== existing.created_at.getTime() ||
        existing.image_urls.length > 0) continue;
    const publishedAt = new Date(Math.max(now.getTime(), existing.updated_at.getTime() + 1, parent.updated_at.getTime() + 1));
    await db.updateTable("venue_versions").set({ state: "published", description: publishedDescription, published_at: publishedAt, updated_at: publishedAt }).where("id", "=", existing.id).execute();
    await db.updateTable("venues").set({ updated_at: publishedAt }).where("id", "=", parent.id).execute();
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
    const subject = { ana: "wedding", ben: "birthday", camille: "corporate", daniel: "wedding", ella: "birthday" }[user.key] ?? "private";
    for (const [index, sender, body] of [[0, customer, `Hello, I would like to ask about a ${subject} event.`], [1, admin, "Thanks for reaching out. Please share your preferred date and guest count."]] as const) {
      const message = await db.insertInto("messages").values({ id: seedId(`message:${user.key}:${index}`), conversation_id: conversation.id, sender_id: sender.id, body, created_at: new Date(now.getTime() + index * 600000), read_at: index === 0 ? new Date(now.getTime() + 600000) : null })
        .onConflict((conflict) => conflict.doNothing()).returning("id").executeTakeFirst();
      if (message) count.messages++;
    }
  }

  return count;
}
