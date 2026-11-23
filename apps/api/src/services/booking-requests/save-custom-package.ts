import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { findBookingRequestData } from "../../data/booking-requests/find-booking-request.js";
import { lockBookingRequestData } from "../../data/booking-requests/lock-booking-request.js";
import { findCustomPackageData } from "../../data/booking-requests/find-custom-package.js";
import { findAnyPackageData } from "../../data/booking-requests/find-any-package.js";
import { lockAnyPackageData } from "../../data/booking-requests/lock-any-package.js";
import { createCustomPackageData } from "../../data/booking-requests/create-custom-package.js";
import { listOwnerMediaIdsData } from "../../data/catalog-media/catalog-media-ownership.js";
import {
  InvalidCatalogMedia,
  replaceCatalogSectionsService,
} from "../catalog-canvas/replace-catalog-sections.js";
import { findCatalogMediaData } from "../../data/catalog-media/find-catalog-media.js";
import { createCatalogMediaData } from "../../data/catalog-media/create-catalog-media.js";
import { updatePackageData } from "../../data/packages/update-package.js";
import { packageDto } from "../packages/package-response.js";
import { nextUpdate } from "../packages/package-rules.js";
import { customPackageResult } from "./custom-package-result.js";
import { cleanupCatalogMediaService } from "../catalog-media/cleanup-catalog-media.js";
import { pendingCatalogMediaKey } from "../../utils/catalog-media-paths.js";
import { promoteOwnerCatalogMediaService } from "../catalog-media/promote-catalog-media.js";
import { readCatalogMediaService } from "../catalog-media/read-catalog-media.js";
import { putCatalogMedia } from "../../utils/catalog-media-storage.js";
import { serviceError } from "../../utils/service-result.js";

const error = (message: string, status: 400 | 404 | 409 | 502) =>
  serviceError(message, status);

export type CustomPackageInput = Content & {
  expectedBookingUpdatedAt: string;
  expectedUpdatedAt?: string;
  sourcePackageId?: string;
};

async function stageSourceMedia(
  db: Kysely<DB>,
  sourceId: string,
  content: Content,
  actorId: string,
  stagedIds: string[],
) {
  const sourceIds = await listOwnerMediaIdsData(db, {
    kind: "package",
    id: sourceId,
  });

  const requestedIds = [
    ...new Set([
      ...content.sections.flatMap((section) =>
        section.widgets.flatMap((widget) =>
          widget.media?.source === "upload" && widget.media.id
            ? [widget.media.id]
            : [],
        ),
      ),
      ...(content.thumbnailMediaId ? [content.thumbnailMediaId] : []),
    ]),
  ].filter((id) => sourceIds.includes(id));

  const replacements = new Map<string, string>();

  for (const sourceMediaId of requestedIds) {
    const source = await findCatalogMediaData(db, sourceMediaId);

    if (!source?.storage_key || !source.mime_type || source.source !== "upload")
      throw new InvalidCatalogMedia(
        "Source media is unavailable. Refresh and try again",
      );

    const id = randomUUID(),
      key = pendingCatalogMediaKey(actorId, id, source.mime_type);
    await createCatalogMediaData(db, {
      id,
      kind: source.kind,
      source: "upload",
      storage_key: key,
      mime_type: source.mime_type,
      byte_size: source.byte_size,
      created_by: actorId,
    });
    stagedIds.push(id);
    const stream = await readCatalogMediaService(
      db,
      sourceMediaId,
      source.storage_key,
      undefined,
      AbortSignal.timeout(30_000),
    );
    await putCatalogMedia(
      key,
      new Uint8Array(await new Response(stream).arrayBuffer()),
      source.mime_type,
    );
    replacements.set(sourceMediaId, id);
  }

  return {
    ...content,
    thumbnailMediaId: content.thumbnailMediaId
      ? (replacements.get(content.thumbnailMediaId) ?? content.thumbnailMediaId)
      : content.thumbnailMediaId,
    sections: content.sections.map((section) => ({
      ...section,
      widgets: section.widgets.map((widget) => {
        const media = widget.media;
        const id = media?.id && replacements.get(media.id);

        return media && id
          ? {
              ...widget,
              media: { ...media, id, url: `/v1/catalog-media/${id}` },
            }
          : widget;
      }),
    })),
  };
}

export async function saveCustomPackageService(
  db: Kysely<DB>,
  id: string,
  actorId: string,
  input: CustomPackageInput,
  create: boolean,
) {
  const stagedIds: string[] = [];
  let previousMediaIds: string[] = [];

  try {
    const booking = await findBookingRequestData(db, id);

    if (!booking) return error("Booking request not found", 404);

    const custom = await findCustomPackageData(db, id);
    const sourceId = create
      ? (input.sourcePackageId ?? booking.package_id)
      : custom?.id;
    const source = sourceId
      ? await findAnyPackageData(db, sourceId)
      : undefined;

    if (sourceId && !source) return error("Package not found", 404);

    if (!create && !source) return error("Package not found", 404);

    if (["declined", "cancelled"].includes(booking.status))
      return error("Closed booking requests cannot be customized", 409);

    if (
      booking.revision !== input.expectedBookingUpdatedAt ||
      (source && source.updated_at.toISOString() !== input.expectedUpdatedAt)
    )
      return error("Booking or package changed. Refresh and try again", 409);

    if (
      (create && (custom || (source && source.package_type !== "catalog"))) ||
      (!create && (!custom || source?.id !== custom.id))
    )
      return error("Custom package state changed. Refresh and try again", 409);

    if (source?.archived_at)
      return error("Archived packages cannot be customized", 409);

    let content: Content = input;

    if (create && source) {
      try {
        content = await stageSourceMedia(
          db,
          source.id,
          input,
          actorId,
          stagedIds,
        );
      } catch (cause) {
        if (cause instanceof InvalidCatalogMedia) throw cause;

        await cleanupCatalogMediaService(db, stagedIds);

        return error("Could not copy package media. Try again", 502);
      }
    }

    const outcome = await db.transaction().execute(async (trx) => {
      const currentBooking = await lockBookingRequestData(trx, id);

      if (!currentBooking) return error("Booking request not found", 404);

      const current = source
        ? await lockAnyPackageData(trx, source.id)
        : undefined;
      const currentCustom = await findCustomPackageData(trx, id);

      if (
        (source && !current) ||
        currentBooking.revision !== input.expectedBookingUpdatedAt ||
        (current &&
          current.updated_at.toISOString() !== input.expectedUpdatedAt)
      )
        return error("Booking or package changed. Refresh and try again", 409);

      if (["declined", "cancelled"].includes(currentBooking.status))
        return error("Closed booking requests cannot be customized", 409);

      if (
        current?.archived_at ||
        (create
          ? (current && current.package_type !== "catalog") || !!currentCustom
          : !current || currentCustom?.id !== current.id)
      )
        return error(
          "Custom package state changed. Refresh and try again",
          409,
        );

      const before = current ? await packageDto(trx, current) : null;
      const now = current ? nextUpdate(current.updated_at) : new Date();

      if (!create && !current)
        return error(
          "Custom package state changed. Refresh and try again",
          409,
        );

      const saved = create
        ? await createCustomPackageData(
            trx,
            id,
            content,
            now,
            `private:${randomUUID()}`,
          )
        : current
          ? await updatePackageData(trx, current.id, content, current.slug, now)
          : undefined;

      if (!saved) throw new Error("Custom package state is unavailable");

      previousMediaIds = await replaceCatalogSectionsService(
        trx,
        { kind: "package", id: saved.id },
        content,
        actorId,
        create ? current?.id : undefined,
      );

      if (!create && current?.thumbnail_media_id)
        previousMediaIds.push(current.thumbnail_media_id);

      return customPackageResult(trx, {
        bookingId: id,
        actorId,
        create,
        before,
        saved,
      });
    });

    if (!("status" in outcome))
      await promoteOwnerCatalogMediaService(db, {
        kind: "package",
        id: outcome.package.id,
      });

    await cleanupCatalogMediaService(
      db,
      "status" in outcome ? stagedIds : previousMediaIds,
    );

    return outcome;
  } catch (cause) {
    await cleanupCatalogMediaService(db, stagedIds);

    if (cause instanceof InvalidCatalogMedia) return error(cause.message, 400);

    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      cause.code === "23505"
    )
      return error("Custom package already exists. Refresh and try again", 409);

    throw cause;
  }
}
