import { z } from "zod";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { embedPackageJob } from "./handlers/embed-package.js";
import { embedServiceJob } from "./handlers/embed-service.js";

export const backgroundJobSettings = {
  pollIntervalMs: 3_000,
  concurrency: 3,
  leaseMs: 60_000,
  heartbeatMs: 20_000,
} as const;

function defineJob<S extends z.ZodType>(definition: {
  payloadSchema: S;
  dedupeKey: (payload: z.output<S>) => string;
  handler: (
    db: Kysely<DB>,
    payload: z.output<S>,
    signal: AbortSignal,
  ) => Promise<void>;
  retryDelaysMs: readonly number[];
  timeoutMs: number;
}) {
  return {
    ...definition,
    parse: (payload: unknown) => {
      const parsed = definition.payloadSchema.parse(payload);

      return { payload: parsed, key: definition.dedupeKey(parsed) };
    },
    run: (db: Kysely<DB>, payload: unknown, signal: AbortSignal) =>
      definition.handler(db, definition.payloadSchema.parse(payload), signal),
  };
}

const uuid = z.uuid().transform((id) => id.toLowerCase());

export const jobDefinitions = {
  embed_package: defineJob({
    payloadSchema: z.object({ packageId: uuid }).strict(),
    dedupeKey: (payload) => payload.packageId,
    handler: embedPackageJob,
    retryDelaysMs: [10_000, 60_000, 300_000],
    timeoutMs: 120_000,
  }),
  embed_service: defineJob({
    payloadSchema: z.object({ serviceId: uuid }).strict(),
    dedupeKey: (payload) => payload.serviceId,
    handler: embedServiceJob,
    retryDelaysMs: [10_000, 60_000, 300_000],
    timeoutMs: 120_000,
  }),
} as const;

export type BackgroundJobType = keyof typeof jobDefinitions;

export type BackgroundJobPayload<T extends BackgroundJobType> = z.input<
  (typeof jobDefinitions)[T]["payloadSchema"]
>;

export const backgroundJobPolicies = Object.fromEntries(
  Object.entries(jobDefinitions).map(([type, definition]) => [
    type,
    definition.retryDelaysMs,
  ]),
);

export function isBackgroundJobType(type: string): type is BackgroundJobType {
  return Object.hasOwn(jobDefinitions, type);
}

export async function executeJob(
  type: BackgroundJobType,
  payload: unknown,
  db: Kysely<DB>,
  signal: AbortSignal,
) {
  return jobDefinitions[type].run(db, payload, signal);
}
