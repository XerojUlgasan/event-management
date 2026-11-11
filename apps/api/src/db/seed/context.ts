import { createHash } from "node:crypto";
import type { Insertable, Transaction } from "kysely";
import type { DB } from "../types.js";

export const SCENARIO_COUNT = 100;
export const LOCAL_PASSWORD = "p@ssword01";
export type SeedDb = Transaction<DB>;

/** Stable UUID for a seed key. Existing rows are never updated. */
export function scenarioId(key: string) {
  const bytes = createHash("sha256").update(`clemora-scenario-v1:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function scenarioIndex(index: number) {
  return String(index + 1).padStart(3, "0");
}

export function seedClock() {
  const value = process.env.SEED_CLOCK;
  if (!value) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new Error("SEED_CLOCK must be an ISO UTC timestamp, for example 2026-10-31T00:00:00Z");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("SEED_CLOCK is not a valid date");
  return date;
}

/** Deterministic unit interval. SEED_RANDOM_SEED changes the shuffle only. */
export function seedRandom(seedText = process.env.SEED_RANDOM_SEED ?? "clemora-scenario-v1") {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) hash = Math.imul(hash ^ seedText.charCodeAt(i), 16777619);
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = copy[i];
    const swap = copy[j];
    if (current === undefined || swap === undefined) throw new Error("Shuffle index was empty");
    copy[i] = swap;
    copy[j] = current;
  }
  return copy;
}

export function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** 09:00–18:00 in Asia/Manila, stored as timestamptz. */
export function manilaInterval(day: string) {
  return {
    day,
    startsAt: new Date(`${day}T01:00:00.000Z`),
    endsAt: new Date(`${day}T10:00:00.000Z`),
  };
}

export async function insertIfNew<T extends keyof DB>(
  db: SeedDb,
  table: T,
  values: Insertable<DB[T]>,
) {
  const inserted = await db
    .insertInto(table)
    .values(values)
    .onConflict((conflict) => conflict.column("id").doNothing())
    .returning("id")
    .executeTakeFirst();
  return inserted !== undefined;
}

export function expectCount(label: string, count: number) {
  if (count !== SCENARIO_COUNT) throw new Error(`${label} planned ${count} rows; expected ${SCENARIO_COUNT}`);
}
