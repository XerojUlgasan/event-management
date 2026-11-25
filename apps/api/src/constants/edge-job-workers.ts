import type { BackgroundJobType } from "../services/background-jobs/job-definitions.js";

export const workerTokenHeader = "x-clemora-worker-token";

export const edgeJobWorkers = {
  catalog: {
    path: "/_internal/catalog-index",
    secret: "clemora_catalog_index_worker_signing",
    scheduleName: "clemora-catalog-indexing",
    interval: "10 seconds",
    jobTypes: ["embed_package", "embed_service"],
  },
  images: {
    path: "/_internal/image-messages",
    secret: "clemora_image_message_worker_signing",
    scheduleName: "clemora-image-messages",
    interval: "5 seconds",
    jobTypes: ["process_image_message"],
  },
} as const satisfies Record<
  string,
  {
    path: string;
    secret: string;
    scheduleName: string;
    interval: string;
    jobTypes: readonly BackgroundJobType[];
  }
>;

export type EdgeJobWorker =
  (typeof edgeJobWorkers)[keyof typeof edgeJobWorkers];
