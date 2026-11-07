import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { findBookingRequestData, lockBookingRequestData, updateBookingDetailsData } from "../../data/booking-requests/booking-requests.js";
import { findCurrentBookingPackageData, lockCurrentBookingPackageData, createCustomPackageData } from "../../data/booking-requests/custom-package.js";
import { InvalidPackageMedia, listPackageMediaIdsData, replacePackageSectionsData } from "../../data/packages/catalog-page.js";
import { validatePackageServicesData, replacePackageServicesData } from "../../data/packages/package-services.js";
import { createCatalogMediaData } from "../../data/catalog-media/catalog-media.js";
import { createAuditEventData } from "../../data/audit/audit-events.js";
import { updatePackageData } from "../../data/packages/update-package.js";
import { packageDto } from "../packages/package-response.js";
import { nextUpdate } from "../packages/package-rules.js";
import { bookingResponse } from "./response.js";
import { cleanupCatalogMediaService } from "../catalog-media/catalog-media.js";
import { getCatalogMedia, putCatalogMedia } from "../../utils/catalog-media-storage.js";

const error = (message: string, status: 400 | 404 | 409 | 502) => ({ message, status });
export type CustomPackageInput = Content & { expectedBookingUpdatedAt: string; expectedUpdatedAt: string };

export async function getBookingPackageService(db: Kysely<DB>, id: string, customerId?: string) {
  return db.transaction().setIsolationLevel("repeatable read").execute(async trx => {
    const booking = await findBookingRequestData(trx, id, customerId);
    if (!booking) return null;
    const pkg = await findCurrentBookingPackageData(trx, booking.package_id);
    if (!pkg || (pkg.package_type === "custom" && pkg.custom_for_booking_request_id !== id)) return null;
    return { package: await packageDto(trx, pkg, { includeArchivedServices: !customerId }), bookingUpdatedAt: booking.updated_at.toISOString() };
  });
}

/** Source bytes are copied before the short DB transaction. Pending asset rows make
 * interrupted staging recoverable by the existing unreferenced-media cleanup. */
async function stageSourceMedia(db: Kysely<DB>, sourceId: string, content: Content, actorId: string, stagedIds: string[]) {
  const sourceIds = await listPackageMediaIdsData(db, sourceId);
  const requestedIds = [...new Set(content.sections.flatMap(section => section.widgets.flatMap(widget => widget.media?.source === "upload" && widget.media.id ? [widget.media.id] : [])))].filter(id => sourceIds.includes(id));
  const replacements = new Map<string, string>();
  for (const sourceMediaId of requestedIds) {
    const source = await db.selectFrom("media_assets").selectAll().where("id", "=", sourceMediaId).executeTakeFirst();
    if (!source?.storage_key || !source.mime_type || source.source !== "upload") throw new InvalidPackageMedia("Source media is unavailable. Refresh and try again");
    const id = randomUUID(), key = `catalog-media/${id}`;
    await createCatalogMediaData(db, { id, kind: source.kind, source: "upload", storage_key: key, mime_type: source.mime_type, byte_size: source.byte_size, created_by: actorId });
    stagedIds.push(id);
    const object = await getCatalogMedia(source.storage_key);
    if (!object.Body) throw new Error("Source media could not be copied");
    await putCatalogMedia(key, await object.Body.transformToByteArray(), source.mime_type);
    replacements.set(sourceMediaId, id);
  }
  return { ...content, sections: content.sections.map(section => ({ ...section, widgets: section.widgets.map(widget => {
    const media = widget.media;
    const id = media?.id && replacements.get(media.id);
    return media && id ? { ...widget, media: { ...media, id, url: `/v1/catalog-media/${id}` } } : widget;
  }) })) };
}

export async function saveCustomPackageService(db: Kysely<DB>, id: string, actorId: string, input: CustomPackageInput, create: boolean) {
  const stagedIds: string[] = [];
  let previousMediaIds: string[] = [];
  try {
    // Reject obvious stale/closed/duplicate saves before any external storage work.
    const booking = await findBookingRequestData(db, id);
    if (!booking) return error("Booking request not found", 404);
    const source = await findCurrentBookingPackageData(db, booking.package_id);
    if (!source) return error("Package not found", 404);
    if (["declined", "cancelled"].includes(booking.status)) return error("Closed booking requests cannot be customized", 409);
    if (booking.updated_at.toISOString() !== input.expectedBookingUpdatedAt || source.updated_at.toISOString() !== input.expectedUpdatedAt) return error("Booking or package changed. Refresh and try again", 409);
    if (create !== (source.package_type === "catalog")) return error("Custom package state changed. Refresh and try again", 409);
    if (source.archived_at) return error("Archived packages cannot be customized", 409);
    let content: Content = input;
    if (create) {
      try { content = await stageSourceMedia(db, source.id, input, actorId, stagedIds); }
      catch (cause) {
        if (cause instanceof InvalidPackageMedia) throw cause;
        await cleanupCatalogMediaService(db, stagedIds);
        return error("Could not copy package media. Try again", 502);
      }
    }
    const outcome = await db.transaction().execute(async trx => {
      const currentBooking = await lockBookingRequestData(trx, id);
      if (!currentBooking) return error("Booking request not found", 404);
      const current = await lockCurrentBookingPackageData(trx, currentBooking.package_id);
      if (!current || current.id !== source.id || currentBooking.updated_at.toISOString() !== input.expectedBookingUpdatedAt || current.updated_at.toISOString() !== input.expectedUpdatedAt) return error("Booking or package changed. Refresh and try again", 409);
      if (["declined", "cancelled"].includes(currentBooking.status)) return error("Closed booking requests cannot be customized", 409);
      if (current.archived_at || create !== (current.package_type === "catalog") || (!create && current.custom_for_booking_request_id !== id)) return error("Custom package state changed. Refresh and try again", 409);
      const invalid = await validatePackageServicesData(trx, create ? null : current.id, content.services);
      if (invalid) return invalid;
      const before = await packageDto(trx, current, { includeArchivedServices: true });
      const now = nextUpdate(new Date(Math.max(current.updated_at.getTime(), currentBooking.updated_at.getTime())));
      const saved = create ? await createCustomPackageData(trx, id, content, now) : await updatePackageData(trx, current.id, content, now);
      previousMediaIds = await replacePackageSectionsData(trx, saved.id, content, actorId, now);
      await replacePackageServicesData(trx, saved.id, content.services);
      const updatedBooking = await updateBookingDetailsData(trx, id, { package_id: saved.id, updated_by: actorId, updated_at: now });
      // A linked conversation must sort/refresh after replacement too.
      await trx.updateTable("conversations").set({ updated_at: now }).where("booking_request_id", "=", id).execute();
      const pkg = await packageDto(trx, saved, { includeArchivedServices: true });
      await createAuditEventData(trx, { actor_id: actorId, action: create ? "booking.custom_package_replaced" : "booking.custom_package_updated", entity_type: "booking_request", entity_id: id, metadata: JSON.stringify({ previousPackageId: current.id, packageId: saved.id, before, after: pkg }) });
      const [bookingRequest] = await bookingResponse(trx, [updatedBooking], true);
      if (!bookingRequest) throw new Error("Saved booking response is unavailable");
      return { package: pkg, bookingRequest };
    });
    await cleanupCatalogMediaService(db, "status" in outcome ? stagedIds : previousMediaIds);
    return outcome;
  } catch (cause) {
    await cleanupCatalogMediaService(db, stagedIds);
    if (cause instanceof InvalidPackageMedia) return error(cause.message, 400);
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505") return error("Custom package already exists. Refresh and try again", 409);
    throw cause;
  }
}
