import type { BackgroundJobLease } from "../../data/background-jobs/assert-job-lease.js";
import { z } from "zod";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { imageMessageJobPayloadSchema } from "../../types/image-message-job.js";

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
    lease?: BackgroundJobLease,
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
    run: (
      db: Kysely<DB>,
      payload: unknown,
      signal: AbortSignal,
      lease?: BackgroundJobLease,
    ) =>
      definition.handler(
        db,
        definition.payloadSchema.parse(payload),
        signal,
        lease,
      ),
  };
}

const uuid = z.uuid().transform((id) => id.toLowerCase());

const retryDelaysMs = [10_000, 60_000, 300_000] as const;

export const jobDefinitions = {
  process_image_message: defineJob({
    payloadSchema: imageMessageJobPayloadSchema,
    dedupeKey: (payload) => payload.messageId,
    handler: async (db, payload, signal, lease) =>
      (
        await import("./handlers/process-image-message.js")
      ).processImageMessageJob(db, payload, signal, lease),
    retryDelaysMs,
    timeoutMs: 240_000,
  }),
  embed_package: defineJob({
    payloadSchema: z.object({ packageId: uuid }).strict(),
    dedupeKey: (payload) => payload.packageId,
    handler: async (db, payload, signal) =>
      (await import("./handlers/embed-package.js")).embedPackageJob(
        db,
        payload,
        signal,
      ),
    retryDelaysMs,
    timeoutMs: 120_000,
  }),
  embed_service: defineJob({
    payloadSchema: z.object({ serviceId: uuid }).strict(),
    dedupeKey: (payload) => payload.serviceId,
    handler: async (db, payload, signal) =>
      (await import("./handlers/embed-service.js")).embedServiceJob(
        db,
        payload,
        signal,
      ),
    retryDelaysMs,
    timeoutMs: 120_000,
  }),
  extract_supporting_document: defineJob({
    payloadSchema: z.object({ documentId: uuid }).strict(),
    dedupeKey: (payload) => payload.documentId,
    handler: async (db, payload, signal, lease) =>
      (
        await import("./handlers/extract-supporting-document.js")
      ).extractSupportingDocumentJob(db, payload, signal, lease),
    retryDelaysMs,
    timeoutMs: 120_000,
  }),
  embed_document_chunk: defineJob({
    payloadSchema: z.object({ chunkId: uuid }).strict(),
    dedupeKey: (payload) => payload.chunkId,
    handler: async (db, payload, signal, lease) =>
      (
        await import("./handlers/embed-document-chunk.js")
      ).embedDocumentChunkJob(db, payload, signal, lease),
    retryDelaysMs,
    timeoutMs: 60_000,
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
  lease?: BackgroundJobLease,
) {
  return jobDefinitions[type].run(db, payload, signal, lease);
}
