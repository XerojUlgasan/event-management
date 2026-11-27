import type { BackgroundJobType } from "../services/background-jobs/job-definitions.js";

export const workerTokenHeader = "x-amac-worker-token";
export const legacyWorkerTokenHeader = "x-clemora-worker-token";
export const workerVersionHeader = "x-amac-worker-version";
export const workerVersion = "1";

export const edgeJobWorkers = {
  catalog: {
    path: "/_internal/catalog-index",
    secret: "amac_catalog_index_worker_signing",
    legacySecret: "clemora_catalog_index_worker_signing",
    scheduleName: "amac-catalog-indexing",
    interval: "10 seconds",
    jobTypes: ["embed_package", "embed_service"],
  },
  images: {
    path: "/_internal/image-messages",
    secret: "amac_image_message_worker_signing",
    legacySecret: "clemora_image_message_worker_signing",
    scheduleName: "amac-image-messages",
    interval: "5 seconds",
    jobTypes: ["process_image_message"],
  },
} as const satisfies Record<
  string,
  {
    path: string;
    secret: string;
    legacySecret: string;
    scheduleName: string;
    interval: string;
    jobTypes: readonly BackgroundJobType[];
  }
>;

export type EdgeJobWorker =
  (typeof edgeJobWorkers)[keyof typeof edgeJobWorkers];
