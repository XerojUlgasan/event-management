import assert from "node:assert/strict";
import test from "node:test";
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import {
  catalogTextMatch,
  keysetPredicate,
  utcTimestampSql,
} from "../src/utils/sql-page.js";

const db = new Kysely<Record<string, never>>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (database) => new PostgresIntrospector(database),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

test("UTC timestamp SQL keeps the microsecond format and quotes the column", () => {
  const compiled = utcTimestampSql("m.created_at").compile(db);
  assert.equal(
    compiled.sql,
    `to_char("m"."created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  );
  assert.deepEqual(compiled.parameters, []);
});

test("keyset SQL compares the timestamp and id in the requested direction", () => {
  const compiled = keysetPredicate(
    "created_at",
    "id",
    "2026-11-18T00:00:00.000000Z",
    "6f1e8c0a-1b2c-4d3e-8f90-aabbccddeeff",
    ">",
  ).compile(db);
  assert.match(compiled.sql, /"created_at", "id"\) > \(/);
  assert.match(compiled.sql, /::timestamptz/);
  assert.match(compiled.sql, /::uuid/);
  assert.deepEqual(compiled.parameters, [
    "2026-11-18T00:00:00.000000Z",
    "6f1e8c0a-1b2c-4d3e-8f90-aabbccddeeff",
  ]);
});

test("catalog text search binds the term and rejects a bad column", () => {
  const compiled = catalogTextMatch("garden").compile(db);
  assert.match(compiled.sql, /strpos\(lower\(name \|\| ' ' \|\| description\)/);
  assert.deepEqual(compiled.parameters, ["garden"]);
  assert.throws(() => utcTimestampSql("created_at; drop"));
});
