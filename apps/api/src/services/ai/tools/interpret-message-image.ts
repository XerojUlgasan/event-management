import {
  assertImageMessageJobLeaseData,
  type ImageMessageJobLease,
} from "../../../data/messages/message-processing.js";
import { createHash } from "node:crypto";
import { tool } from "ai";
import { z } from "zod";
import type { Kysely } from "kysely";
import type { DB } from "../../../db/types.js";
import { finishToolCallData } from "../../../data/ai/finish-tool-call.js";
import { startImageToolCallData } from "../../../data/ai/start-image-tool-call.js";
import { env } from "../../../utils/env.js";
import { interpretMessageImage } from "../interpret-message-image.js";

export const interpretMessageImageInputSchema = z.object({}).strict();

export function createInterpretMessageImageTool(options: {
  db: Kysely<DB>;
  sourceMessageId: string;
  lease?: ImageMessageJobLease;
  turnId: string;
  imageId: string;
  position: number;
  image: { bytes: Uint8Array; mimeType: string; contentHash: string };
}) {
  return tool({
    description: "Interpret a server-bound image for this conversation.",
    inputSchema: interpretMessageImageInputSchema,
    execute: async (input, { toolCallId, abortSignal }) => {
      interpretMessageImageInputSchema.parse(input);

      if (toolCallId !== options.imageId)
        throw new Error("Invalid image call ID");

      let model: string | null = null;

      try {
        model = env.AI_VISION.model;
      } catch {
        /* Record missing configuration as a failed call. */
      }

      const fenced = <T>(
        operation: (trx: import("kysely").Transaction<DB>) => Promise<T>,
      ) =>
        options.db.transaction().execute(async (trx) => {
          if (options.lease)
            await assertImageMessageJobLeaseData(
              trx,
              options.lease,
              abortSignal,
            );

          return operation(trx);
        });

      const call = await fenced((trx) =>
        startImageToolCallData(trx, {
          turnId: options.turnId,
          imageId: options.imageId,
          sourceMessageId: options.sourceMessageId,
          input: {
            model,
            imageId: options.imageId,
            position: options.position,
            mimeType: options.image.mimeType,
            byteSize: options.image.bytes.length,
            contentHash: options.image.contentHash,
          },
        }),
      );

      let observation;

      try {
        observation = await interpretMessageImage(options.image, abortSignal);
      } catch {
        await fenced((trx) =>
          finishToolCallData(trx, {
            id: call.id,
            status: "failed",
            errorCode: abortSignal?.aborted
              ? "cancelled"
              : "vision_unavailable",
          }),
        );
        throw new Error("Image interpretation unavailable");
      }

      const encoded = JSON.stringify(observation);
      await fenced((trx) =>
        finishToolCallData(trx, {
          id: call.id,
          status: "succeeded",
          output: {
            observationSha256: createHash("sha256")
              .update(encoded)
              .digest("hex"),
            objectCount: observation.objects.length,
            colorCount: observation.colors.length,
            styleCount: observation.styles.length,
            uncertaintyCount: observation.uncertainty.length,
            hasVisibleText: observation.visibleText !== null,
          },
        }),
      );

      return observation;
    },
  });
}
