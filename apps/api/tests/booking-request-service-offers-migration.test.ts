import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { reviewedServiceSchema } from "@event-management/contracts/booking-draft";
import { Pool, type PoolClient } from "pg";

const migration = "20261122020000_booking_request_service_offers";
const quotationHoursMigration = "20261122020100_quotation_booking_addon_hours";

const migrations = new URL("../prisma/migrations/", import.meta.url);

async function withDisposableDatabase(run: (db: PoolClient) => Promise<void>) {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_service_offer_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  const pool = new Pool({ ...connection, database });

  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    const db = await pool.connect();

    try {
      for (const entry of (await readdir(migrations, { withFileTypes: true }))
        .filter((item) => item.isDirectory() && item.name < migration)
        .sort((left, right) => left.name.localeCompare(right.name)))
        await db.query(
          await readFile(
            new URL(`${entry.name}/migration.sql`, migrations),
            "utf8",
          ),
        );

      await run(db);
    } finally {
      db.release();
    }
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
}

const migrationSql = () =>
  readFile(new URL(`${migration}/migration.sql`, migrations), "utf8");

async function assertSchema(db: PoolClient) {
  const { rows } = await db.query(
    `SELECT
      EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'addon_services') AS old_column,
      (SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'booking_requests_requested_services_idx') AS reference_index`,
  );
  assert.equal(rows[0]?.old_column, false);
  assert.match(
    rows[0]?.reference_index,
    /USING gin \(requested_services jsonb_path_ops\)/,
  );
}

test("fresh booking service-offer migration installs the reference index and removes the legacy column", async () => {
  await withDisposableDatabase(async (db) => {
    await db.query(await migrationSql());
    await assertSchema(db);
    assert.deepEqual(
      (await db.query("SELECT id FROM booking_requests")).rows,
      [],
    );
  });
});

type Intake = {
  serviceId: string | null;
  name: string;
  hours: number | null;
  notes: string | null;
  included: boolean;
  updatedAt: string | null;
  catalogPricing?: {
    fixedPricePesos: number | null;
    includedHours: number | null;
    hourlyRatePesos: number;
  };
};

type MigratedIntake = Intake & {
  id: string;
  origin?: "admin";
  offer?: NonNullable<Intake["catalogPricing"]> & { totalHours: number | null };
};

type LegacyAddon = NonNullable<Intake["catalogPricing"]> & {
  id: string;
  serviceId: string;
};

test("upgrading derives private and manual offers, preserving intake, drafts, and delivered history", async () => {
  await withDisposableDatabase(async (db) => {
    const sql = await migrationSql();
    const customer = (
      await db.query<{ id: string }>(
        "INSERT INTO users(email,password_hash,role) VALUES('service-offer@example.test','unused','customer') RETURNING id",
      )
    ).rows[0]!.id;
    const createdAt = "2026-11-20T13:00:00.000Z";
    const historicalTerm = {
      fixedPricePesos: 1000,
      includedHours: 2,
      hourlyRatePesos: 200,
    };
    const confirmedTerm = {
      fixedPricePesos: 1800,
      includedHours: 3,
      hourlyRatePesos: 350,
    };
    const hourlyTerm = {
      fixedPricePesos: null,
      includedHours: null,
      hourlyRatePesos: 400,
    };

    const catalogService = async (name: string) =>
      (
        await db.query<{ id: string }>(
          "INSERT INTO services(name,slug,description,updated_at) VALUES($1,lower($1),'Description',$2) RETURNING id",
          [name, createdAt],
        )
      ).rows[0]!.id;

    const sound = await catalogService("Sound");
    const lighting = await catalogService("Lighting");
    const flowers = await catalogService("Flowers");
    const filming = await catalogService("Filming");
    const microphone = await catalogService("Microphone");
    const omitted = await catalogService("Omitted");

    const intake = (
      serviceId: string | null,
      hours: number | null,
      name = "Customer wording",
    ): Intake => ({
      serviceId,
      name,
      hours,
      notes: "Customer notes",
      included: false,
      updatedAt: createdAt,
    });

    const booking = async (
      reference: string,
      services: unknown[],
      submitted = true,
    ) =>
      (
        await db.query<{ id: string }>(
          `INSERT INTO booking_requests(reference,customer_id,event_type,preferred_date,
           time_zone,contact_name,phone_number,out_of_range,submitted_at,updated_at,requested_services)
         VALUES($1,$2,'Wedding','2099-01-01','Asia/Manila','Fixture','000',false,$3,$4,$5)
         RETURNING id`,
          [
            reference,
            customer,
            submitted ? createdAt : null,
            createdAt,
            JSON.stringify(services),
          ],
        )
      ).rows[0]!.id;

    const privateIntake = [
      {
        ...intake(sound.toUpperCase(), 4, "Customer sound request"),
        catalogPricing: historicalTerm,
      },
      intake(sound, 8, "Second sound request"),
      intake(lighting, 5, "Lighting request"),
      intake(filming, 1.5, "Filming request"),
      { ...intake(omitted, 3), catalogPricing: historicalTerm },
      intake(null, null, "Free-text request"),
    ];
    const privateBooking = await booking("PRIVATE-OFFER", privateIntake);
    const manualIntake = [
      intake(sound, null),
      { ...intake(sound, 5), catalogPricing: historicalTerm },
      { ...intake(sound, 6), catalogPricing: historicalTerm },
      { ...intake(filming, 2.5), catalogPricing: historicalTerm },
      intake(lighting, 8),
      { ...intake(omitted, 3), included: true, catalogPricing: historicalTerm },
    ];
    const manualBooking = await booking("MANUAL-OFFER", manualIntake);
    const explicitOmission = [
      { ...intake(omitted, 3), catalogPricing: historicalTerm },
    ];
    const emptyPrivateBooking = await booking(
      "EMPTY-PRIVATE",
      explicitOmission,
    );
    const deliveredBooking = await booking(
      "DELIVERED-OMISSION",
      explicitOmission,
    );
    const draftBooking = await booking(
      "BOOKING-DRAFT",
      [{ serviceId: sound, notes: "draft" }],
      false,
    );
    const emptyBooking = await booking("EMPTY-BOOKING", []);

    const addons: LegacyAddon[] = [
      {
        id: randomUUID().toUpperCase(),
        serviceId: sound.toUpperCase(),
        ...confirmedTerm,
      },
      { id: randomUUID(), serviceId: lighting, ...hourlyTerm },
      { id: randomUUID(), serviceId: filming, ...hourlyTerm },
      { id: randomUUID(), serviceId: flowers, ...hourlyTerm },
      { id: randomUUID(), serviceId: microphone, ...hourlyTerm },
    ];

    const custom = async (owner: string, slug: string, items: typeof addons) =>
      (
        await db.query<{ id: string }>(
          `INSERT INTO packages(name,slug,max_guests,price,published_at,package_type,
           custom_for_booking_request_id,addon_services)
         VALUES($2,$2,100,1000,NULL,'custom',$1,$3) RETURNING id`,
          [owner, slug, JSON.stringify(items)],
        )
      ).rows[0]!.id;

    const packageId = await custom(privateBooking, "private-package", addons);
    await custom(emptyPrivateBooking, "empty-custom", []);
    const publicPackage = (
      await db.query<{ id: string }>(
        "INSERT INTO packages(name,slug,max_guests,price) VALUES('Public','public',100,1000) RETURNING id",
      )
    ).rows[0]!.id;
    const conversation = (
      await db.query<{ id: string }>(
        "INSERT INTO conversations(customer_id,booking_request_id) VALUES($1,$2) RETURNING id",
        [customer, privateBooking],
      )
    ).rows[0]!.id;

    const oldLine = (addonId: string, hours: number, hourly = false) => ({
      id: randomUUID(),
      direction: "add",
      kind: "addition",
      description: "Historic sound terms",
      serviceId: hourly ? microphone : sound,
      amountMinor: (hourly ? 0 : 100000) + hours * 20000,
      addon: {
        source: {
          packageId,
          addonId,
          fixedPriceMinor: hourly ? null : 100000,
          includedHours: hourly ? null : 2,
          hourlyRateMinor: 20000,
        },
        hours,
        fixedPriceOverrideMinor: null,
        hourlyRateOverrideMinor: null,
      },
    });

    const quote = async ({
      bookingId,
      sourcePackage,
      version,
      status,
      items,
      previous = null,
    }: {
      bookingId: string;
      sourcePackage: string;
      version: number;
      status: "superseded" | "sent" | "draft";
      items: ReturnType<typeof oldLine>[];
      previous?: string | null;
    }) =>
      (
        await db.query<{ id: string }>(
          `INSERT INTO quotations(booking_request_id, version, base_amount_minor,
          total_amount_minor, created_by, offered_package_id, status, sent_at, items,
          previous_quotation_id)
         VALUES($1,$2,100000,$3,$4,$5,$6,
           CASE WHEN $6='draft' THEN NULL ELSE now() END,$7,$8) RETURNING id`,
          [
            bookingId,
            version,
            100000 + items.reduce((sum, line) => sum + line.amountMinor, 0),
            customer,
            sourcePackage,
            status,
            JSON.stringify(items),
            previous,
          ],
        )
      ).rows[0]!.id;

    const privateQuote = (
      version: number,
      status: "superseded" | "sent" | "draft",
      items: ReturnType<typeof oldLine>[],
      previous?: string,
    ) =>
      quote({
        bookingId: privateBooking,
        sourcePackage: packageId,
        version,
        status,
        items,
        previous,
      });

    const oldest = await privateQuote(1, "superseded", [
      oldLine(addons[0]!.id, 1),
    ]);
    const matching = await privateQuote(
      2,
      "superseded",
      [oldLine(addons[0]!.id, 6), oldLine(addons[4]!.id, 9, true)],
      oldest,
    );
    const newest = await privateQuote(
      3,
      "sent",
      [oldLine(randomUUID(), 25)],
      matching,
    );
    await privateQuote(4, "draft", [oldLine(addons[0]!.id, 30)], newest);
    await quote({
      bookingId: deliveredBooking,
      sourcePackage: publicPackage,
      version: 1,
      status: "sent",
      items: [],
    });

    await db.query(
      "INSERT INTO messages(conversation_id,sender_id,sender_role,body,quotation_id) VALUES($1,$2,'customer','Original offer',$3)",
      [conversation, customer, matching],
    );
    await db.query(
      "INSERT INTO audit_events(action,entity_type,entity_id,metadata) VALUES('quotation.sent','quotation',$1,$2)",
      [matching, { historical: true, addonServices: addons }],
    );

    const snapshot = async (
      table:
        | "quotations"
        | "messages"
        | "audit_events"
        | "booking_requests"
        | "packages",
    ) =>
      (await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY id`))
        .rows;

    const storedServices = async (id: string) =>
      (
        await db.query<{
          requested_services: MigratedIntake[];
          updated_at: Date;
        }>(
          "SELECT requested_services,updated_at FROM booking_requests WHERE id=$1",
          [id],
        )
      ).rows[0]!;

    // Failed preflights must leave the source column and every booking row intact.
    const beforeBookings = await snapshot("booking_requests");

    const writeAddons = (items: typeof addons) =>
      db.query("UPDATE packages SET addon_services=$2 WHERE id=$1", [
        packageId,
        JSON.stringify(items),
      ]);

    for (const [invalid, expected] of [
      [
        [...addons, { ...addons[0]!, id: randomUUID(), serviceId: sound }],
        /ambiguous private-package/,
      ],
      [[{ ...addons[0]!, includedHours: null }], /invalid private-package/],
    ] as const) {
      await writeAddons([...invalid]);
      const beforePackages = await snapshot("packages");
      await assert.rejects(db.query(sql), expected);
      await db.query("ROLLBACK");
      assert.deepEqual(await snapshot("booking_requests"), beforeBookings);
      assert.deepEqual(await snapshot("packages"), beforePackages);
    }

    await writeAddons(addons);

    const writeIntake = (rows: unknown[]) =>
      db.query(
        "UPDATE booking_requests SET requested_services=$2 WHERE id=$1",
        [manualBooking, JSON.stringify(rows)],
      );

    for (const invalidRow of [
      {
        ...manualIntake[0],
        catalogPricing: { ...historicalTerm, fixedPricePesos: null },
      },
      { ...manualIntake[0], notes: 123 },
      123,
    ]) {
      await writeIntake([invalidRow]);
      const invalidBookings = await snapshot("booking_requests");
      const originalPackages = await snapshot("packages");
      await assert.rejects(
        db.query(sql),
        /malformed submitted requested services/,
      );
      await db.query("ROLLBACK");
      assert.deepEqual(await snapshot("booking_requests"), invalidBookings);
      assert.deepEqual(await snapshot("packages"), originalPackages);
    }

    await writeIntake(manualIntake);
    const historyTables = ["quotations", "messages", "audit_events"] as const;
    const historicalRecords = new Map<string, unknown>();

    for (const table of historyTables)
      historicalRecords.set(table, await snapshot(table));

    await db.query(sql);
    await assertSchema(db);
    const fixed = oldLine(addons[0]!.id, 0);
    const hourly = oldLine(addons[4]!.id, 4, true);

    const withTotalHours = (line: typeof fixed, totalHours: unknown) => ({
      ...line,
      addon: { ...line.addon, totalHours },
    });

    const bookedLines = [withTotalHours(fixed, 1), withTotalHours(hourly, 4)];

    const addBookedQuote = (items: typeof bookedLines) =>
      privateQuote(5, "superseded", items, newest);

    const rejectsInvalidItems = (cause: unknown) =>
      !!cause &&
      typeof cause === "object" &&
      "constraint" in cause &&
      cause.constraint === "quotations_items_check";

    await assert.rejects(addBookedQuote(bookedLines), rejectsInvalidItems);
    await db.query(
      await readFile(
        new URL(`${quotationHoursMigration}/migration.sql`, migrations),
        "utf8",
      ),
    );

    for (const table of historyTables)
      assert.deepEqual(
        await snapshot(table),
        historicalRecords.get(table),
        table,
      );

    for (const invalid of [
      ...[null, "1", 0, 1.5, 2147483648, 3].map((hours) =>
        withTotalHours(fixed, hours),
      ),
      withTotalHours(hourly, 3),
    ])
      await assert.rejects(addBookedQuote([invalid]), rejectsInvalidItems);

    const bookedQuote = await addBookedQuote(bookedLines);
    const { rows: savedQuotes } = await db.query(
      "SELECT items FROM quotations WHERE id = $1",
      [bookedQuote],
    );
    assert.deepEqual(savedQuotes[0]?.items, bookedLines);

    const { requested_services: privateRows, updated_at } =
      await storedServices(privateBooking);
    assert.deepEqual(
      reviewedServiceSchema.array().parse(privateRows),
      privateRows,
    );
    assert.ok(updated_at > new Date(createdAt));
    assert.equal(privateRows.length, privateIntake.length + 2);

    const byIndex = (index: number) => privateRows[index]!;

    assert.equal(byIndex(0).id, addons[0]!.id.toLowerCase());
    assert.deepEqual(byIndex(0).offer, { ...confirmedTerm, totalHours: 8 });
    assert.equal(byIndex(1).offer, undefined);
    assert.equal(byIndex(2).id, addons[1]!.id);
    assert.deepEqual(byIndex(2).offer, { ...hourlyTerm, totalHours: 5 });
    assert.deepEqual(byIndex(3).offer, { ...hourlyTerm, totalHours: null });
    assert.equal(byIndex(4).offer, undefined);
    assert.equal(byIndex(5).offer, undefined);
    assert.deepEqual(byIndex(6), {
      id: addons[3]!.id,
      serviceId: flowers,
      origin: "admin",
      name: "Flowers",
      hours: null,
      notes: null,
      included: false,
      updatedAt: createdAt,
      offer: { ...hourlyTerm, totalHours: null },
    });
    assert.equal(byIndex(7).id, addons[4]!.id);
    assert.equal(byIndex(7).origin, "admin");
    assert.deepEqual(byIndex(7).offer, { ...hourlyTerm, totalHours: 9 });

    for (const [index, original] of privateIntake.entries()) {
      const { id, offer, ...saved } = byIndex(index);
      assert.match(id, /^[0-9a-f-]{36}$/);
      assert.deepEqual(saved, {
        ...original,
        serviceId: original.serviceId?.toLowerCase() ?? null,
      });
    }

    assert.equal(
      new Set(privateRows.map(({ id }) => id)).size,
      privateRows.length,
    );

    const manualRows = (await storedServices(manualBooking)).requested_services;
    assert.deepEqual(
      reviewedServiceSchema.array().parse(manualRows),
      manualRows,
    );
    assert.deepEqual(
      manualRows.map(({ offer }) => offer),
      [
        undefined,
        { ...historicalTerm, totalHours: 5 },
        undefined,
        undefined,
        undefined,
        undefined,
      ],
    );

    for (const id of [emptyPrivateBooking, deliveredBooking]) {
      const row = (await storedServices(id)).requested_services[0];
      assert.equal(row?.offer, undefined);
      assert.match(row!.id, /^[0-9a-f-]{36}$/);
    }

    assert.deepEqual(await storedServices(draftBooking), {
      requested_services: [{ serviceId: sound, notes: "draft" }],
      updated_at: new Date(createdAt),
    });
    assert.deepEqual(await storedServices(emptyBooking), {
      requested_services: [],
      updated_at: new Date(createdAt),
    });
  });
});
