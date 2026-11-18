import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { DB } from "../../src/db/types.js";
import {
  getMyProposalInputSchema,
  getMyProposalService,
} from "../../src/services/ai/get-my-proposal.js";
import { readCatalogSectionsService } from "../../src/services/catalog-canvas/read-catalog-sections.js";

const database = `em_proposal_${randomUUID().replaceAll("-", "")}`;
let admin: Pool;
let db: Kysely<DB>;
before(async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  const pool = new Pool({ ...connection, database });
  db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  const root = new URL("../../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
});
after(async () => {
  await db?.destroy();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});

async function user() {
  return (
    await db
      .insertInto("users")
      .values({
        email: `${randomUUID()}@example.test`,
        password_hash: "unused",
        role: "customer",
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
}
async function booking(customerId: string, packageId: string | null) {
  return (
    await db
      .insertInto("booking_requests")
      .values({
        reference: `TEST-${randomUUID()}`,
        customer_id: customerId,
        package_id: packageId,
        event_type: "Wedding",
        preferred_date: "2099-01-01",
        time_zone: "Asia/Manila",
        contact_name: "Fixture",
        phone_number: "fixture",
        out_of_range: false,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
}
async function conversation(
  customerId: string,
  bookingRequestId: string | null = null,
) {
  return (
    await db
      .insertInto("conversations")
      .values({ customer_id: customerId, booking_request_id: bookingRequestId })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
}
const widget = (type: "markdown" | "photo" | "service", extra: object) => ({
  id: randomUUID(),
  type,
  x: 1,
  y: 2,
  w: 6,
  h: 4,
  markdown: "",
  mediaId: null,
  alt: "",
  caption: "",
  autoplay: false,
  ...extra,
});

test("proposal is scoped to the authenticated conversation and reads current private canvas without truncation", async () => {
  const customerId = await user();
  const otherId = await user();
  const catalog = await db
    .insertInto("packages")
    .values({
      slug: `catalog-${randomUUID()}`,
      name: "Original catalog",
      description: "Original",
      price: 1000,
      max_guests: 100,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const bookingId = await booking(customerId, catalog.id);
  const conversationId = await conversation(customerId, bookingId);
  const original = await getMyProposalService({
    db,
    customerId,
    conversationId,
  });
  assert.equal(original.status, "found");
  if (original.status !== "found") throw new Error("Expected catalog proposal");
  assert.equal(original.proposal.packageType, "catalog");
  assert.equal(original.proposal.name, "Original catalog");
  const otherConversation = await conversation(customerId);
  const otherBooking = await booking(otherId, catalog.id);
  const foreignConversation = await conversation(otherId, otherBooking);
  const media = await db
    .insertInto("media_assets")
    .values({ kind: "image", source: "sample", url: "/images/wedding.jpg" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const service = await db
    .insertInto("services")
    .values({
      slug: `service-${randomUUID()}`,
      name: "Linked service",
      description: "",
      hourly_rate_pesos: 50,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const markdown = "😀".repeat(5000) + "é".repeat(10000);
  const sections = [
    {
      id: randomUUID(),
      title: "Private details",
      widgets: [
        widget("markdown", { markdown }),
        widget("photo", {
          y: 6,
          mediaId: media.id,
          alt: "Table",
          caption: "Setup",
        }),
        widget("service", { y: 10, serviceId: service.id, caption: "Music" }),
      ],
    },
  ];
  const updatedAt = new Date("2098-01-01T00:00:00.000Z");
  const custom = await db
    .insertInto("packages")
    .values({
      slug: `custom-${randomUUID()}`,
      name: "Private proposal",
      description: "Prepared details",
      price: 1250,
      max_guests: 80,
      package_type: "custom",
      custom_for_booking_request_id: bookingId,
      published_at: null,
      updated_at: updatedAt,
      canvas: sql`${JSON.stringify(sections)}::jsonb`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const result = await getMyProposalService({ db, customerId, conversationId });
  assert.equal(result.status, "found");
  if (result.status !== "found") throw new Error("Expected proposal");
  assert.equal(result.proposal.packageType, "custom");
  assert.equal(result.proposal.name, "Private proposal");
  assert.equal(result.proposal.description, "Prepared details");
  assert.equal(result.proposal.maxGuests, 80);
  assert.deepEqual(result.proposal.price, {
    kind: "fixed",
    currency: "PHP",
    amountMinor: 125000,
  });
  assert.equal(result.proposal.updatedAt, updatedAt.toISOString());
  assert.deepEqual(
    result.proposal.sections,
    await readCatalogSectionsService(db, { kind: "package", id: custom.id }),
  );
  assert.equal(result.proposal.sections[0].widgets[0].markdown, markdown);
  assert.deepEqual(
    await getMyProposalService({
      db,
      customerId,
      conversationId: otherConversation,
    }),
    { status: "no_linked_request", proposal: null },
  );
  await assert.rejects(
    getMyProposalService({
      db,
      customerId,
      conversationId: foreignConversation,
    }),
  );
  const mismatchedBooking = await booking(otherId, catalog.id);
  const mismatchedConversation = await conversation(
    customerId,
    mismatchedBooking,
  );
  await assert.rejects(
    getMyProposalService({
      db,
      customerId,
      conversationId: mismatchedConversation,
    }),
  );
  await db
    .updateTable("packages")
    .set({
      name: "Saved edit",
      canvas: sql`${JSON.stringify([{ ...sections[0], widgets: [widget("markdown", { markdown: "Edited text" })] }])}::jsonb`,
    })
    .where("id", "=", custom.id)
    .execute();
  const refreshed = await getMyProposalService({
    db,
    customerId,
    conversationId,
  });
  assert.equal(refreshed.status, "found");
  if (refreshed.status !== "found")
    throw new Error("Expected updated proposal");
  assert.equal(refreshed.proposal.name, "Saved edit");
  assert.equal(
    refreshed.proposal.sections[0].widgets[0].markdown,
    "Edited text",
  );
});

test("unprepared inquiries and strict empty input are explicit", async () => {
  const customerId = await user();
  const bookingId = await booking(customerId, null);
  const conversationId = await conversation(customerId, bookingId);
  assert.deepEqual(
    await getMyProposalService({ db, customerId, conversationId }),
    { status: "proposal_not_prepared", proposal: null },
  );
  assert.equal(getMyProposalInputSchema.safeParse({}).success, true);
  for (const input of [
    { conversationId },
    { customerId },
    { bookingId },
    { packageId: randomUUID() },
  ])
    assert.equal(getMyProposalInputSchema.safeParse(input).success, false);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    getMyProposalService({
      db,
      customerId,
      conversationId,
      abortSignal: controller.signal,
    }),
  );
});
