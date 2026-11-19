import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { CanvasOwner } from "../../data/catalog-canvas/catalog-canvas-types.js";
import { lockCatalogMediaData } from "../../data/catalog-media/lock-catalog-media.js";
import {
  findMediaOwnersData,
  listOwnerMediaIdsData,
  updateMediaStorageKeyData,
} from "../../data/catalog-media/catalog-media-ownership.js";
import {
  isCatalogMediaMimeType,
  ownedCatalogMediaKey,
  pendingCatalogMediaKey,
} from "../../utils/catalog-media-paths.js";
import {
  deleteCatalogMedia,
  getCatalogMedia,
  putCatalogMedia,
} from "../../utils/catalog-media-storage.js";

/** Promote newly attached uploads after the owner save commits. */
export async function promoteOwnerCatalogMediaService(
  db: Kysely<DB>,
  owner: CanvasOwner,
) {
  const stats = { promoted: 0, skipped: 0, failed: 0 };
  let ids: string[];

  try {
    ids = await listOwnerMediaIdsData(db, owner);
  } catch {
    console.warn("Catalog media promotion could not be started.");

    return { ...stats, failed: 1 };
  }

  for (const id of ids) {
    try {
      const result = await db.transaction().execute(async (trx) => {
        const media = await lockCatalogMediaData(trx, id);

        if (
          !media ||
          media.source !== "upload" ||
          !media.storage_key ||
          !media.created_by ||
          !media.mime_type ||
          !isCatalogMediaMimeType(media.mime_type) ||
          (media.kind !== "image" && media.kind !== "video")
        )
          return null;

        const owners = await findMediaOwnersData(trx, id);

        if (owners.packages.length + owners.services.length !== 1) return null;

        const pkg = owners.packages[0];
        const service = owners.services[0];
        const keyMedia = { id, kind: media.kind, mime_type: media.mime_type };
        let target: string;

        if (
          pkg &&
          owner.kind === "package" &&
          owner.id.toLowerCase() === pkg.id
        ) {
          if (
            pkg.package_type === "custom" &&
            pkg.custom_for_booking_request_id
          )
            target = ownedCatalogMediaKey(
              { kind: "booking", id: pkg.custom_for_booking_request_id },
              keyMedia,
            );
          else if (pkg.package_type === "catalog")
            target = ownedCatalogMediaKey(
              { kind: "package", id: pkg.id },
              keyMedia,
            );
          else return null;
        } else if (
          service &&
          owner.kind === "service" &&
          owner.id.toLowerCase() === service.id
        ) {
          target = ownedCatalogMediaKey(
            { kind: "service", id: service.id },
            keyMedia,
          );
        } else return null;

        const pendingKey = pendingCatalogMediaKey(
          media.created_by,
          id,
          media.mime_type,
        );

        if (media.storage_key !== pendingKey && media.storage_key !== target)
          return null;

        if (media.storage_key === pendingKey) {
          const stream = await getCatalogMedia(
            pendingKey,
            undefined,
            AbortSignal.timeout(30_000),
          );
          await putCatalogMedia(
            target,
            new Uint8Array(await new Response(stream).arrayBuffer()),
            media.mime_type,
            { upsert: true },
          );
          await updateMediaStorageKeyData(trx, id, target);
        }

        return { pendingKey, currentKey: target };
      });

      if (!result) {
        stats.skipped++;
        continue;
      }

      await db.transaction().execute(async (trx) => {
        const media = await lockCatalogMediaData(trx, id);

        if (media?.storage_key === result.currentKey)
          await deleteCatalogMedia(result.pendingKey);
      });
      stats.promoted++;
    } catch {
      stats.failed++;
      console.warn(
        "Catalog media promotion or pending cleanup failed; it can be retried on save.",
      );
    }
  }

  return stats;
}
