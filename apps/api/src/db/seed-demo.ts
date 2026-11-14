import { createHash } from "node:crypto";
import type { Transaction } from "kysely";
import type { DB } from "./types.js";

type SeedDb = Transaction<DB>;

// These keys are reserved for this seed. Existing rows are never updated.
function seedId(key: string) {
  const bytes = createHash("sha256")
    .update(`clemora-demo-v1:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function seedClock() {
  const value = process.env.SEED_CLOCK;
  if (!value) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new Error(
      "SEED_CLOCK must be an ISO UTC timestamp, for example 2026-10-31T00:00:00Z",
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error("SEED_CLOCK is not a valid date");
  return date;
}

const users = [
  {
    key: "admin",
    email: "demo.admin@clemora.example.test",
    name: "Mara Santos",
    role: "admin",
    staffRole: "System Administrator",
  },
  {
    key: "ana",
    email: "demo.ana@clemora.example.test",
    name: "Ana Reyes",
    role: "customer",
    staffRole: null,
  },
  {
    key: "ben",
    email: "demo.ben@clemora.example.test",
    name: "Ben Cruz",
    role: "customer",
    staffRole: null,
  },
  {
    key: "camille",
    email: "demo.camille@clemora.example.test",
    name: "Camille Lim",
    role: "customer",
    staffRole: null,
  },
  {
    key: "daniel",
    email: "demo.daniel@clemora.example.test",
    name: "Daniel Flores",
    role: "customer",
    staffRole: null,
  },
  {
    key: "ella",
    email: "demo.ella@clemora.example.test",
    name: "Ella Navarro",
    role: "customer",
    staffRole: null,
  },
] as const;

type UserKey = (typeof users)[number]["key"];
export async function seedDemo(db: SeedDb, passwordHash: string) {
  const now = seedClock();
  const count = {
    users: 0,
    services: 0,
    packages: 0,
    assignments: 0,
    requests: 0,
    history: 0,
    conversations: 0,
    messages: 0,
  };
  const persistedUsers = new Map<
    UserKey,
    { id: string; role: string; staffRole: string | null; name: string }
  >();

  for (const user of users) {
    const id = seedId(`user:${user.key}`);
    if (
      !(await db
        .selectFrom("users")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst())
    ) {
      const inserted = await db
        .insertInto("users")
        .values({
          id,
          email: user.email,
          display_name: user.name,
          role: user.role,
          staff_role: user.staffRole,
          password_hash: passwordHash,
          created_at: now,
          updated_at: now,
        })
        .onConflict((conflict) => conflict.doNothing())
        .returning("id")
        .executeTakeFirst();
      if (inserted) count.users++;
    }
    const row = await db
      .selectFrom("users")
      .select(["id", "role", "staff_role", "display_name"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (row)
      persistedUsers.set(user.key, {
        id: row.id,
        role: row.role,
        staffRole: row.staff_role,
        name: row.display_name ?? user.name,
      });
  }

  for (const user of users.filter((item) => item.role === "customer")) {
    const customer = persistedUsers.get(user.key);
    const admin = persistedUsers.get("admin");
    if (
      !customer ||
      customer.role !== "customer" ||
      !admin ||
      admin.role !== "admin" ||
      admin.staffRole !== "System Administrator"
    )
      continue;
    const id = seedId(`conversation:${user.key}`);
    const inserted = await db
      .insertInto("conversations")
      .values({
        id,
        customer_id: customer.id,
        created_at: now,
        updated_at: now,
      })
      .onConflict((conflict) => conflict.doNothing())
      .returning("id")
      .executeTakeFirst();
    if (inserted) count.conversations++;
    const conversation = await db
      .selectFrom("conversations")
      .select(["id", "customer_id"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!conversation || conversation.customer_id !== customer.id) continue;
    const subject =
      {
        ana: "wedding",
        ben: "birthday",
        camille: "corporate",
        daniel: "wedding",
        ella: "birthday",
      }[user.key] ?? "private";
    for (const [index, sender, body] of [
      [0, customer, `Hello, I would like to ask about a ${subject} event.`],
      [
        1,
        admin,
        "Thanks for reaching out. Please share your preferred date and guest count.",
      ],
    ] as const) {
      const message = await db
        .insertInto("messages")
        .values({
          id: seedId(`message:${user.key}:${index}`),
          conversation_id: conversation.id,
          sender_id: sender.id,
          sender_role: index === 0 ? "customer" : "admin",
          body,
          created_at: new Date(now.getTime() + index * 600000),
          read_at: index === 0 ? new Date(now.getTime() + 600000) : null,
        })
        .onConflict((conflict) => conflict.doNothing())
        .returning("id")
        .executeTakeFirst();
      if (message) count.messages++;
    }
  }

  return count;
}
