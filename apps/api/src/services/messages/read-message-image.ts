import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  findPrivateMessageImageData,
  ownsMessageImageGuestData,
} from "../../data/messages/find-private-message-image.js";
import { resolveSessionService } from "../auth/resolve-session.js";
import { hashSessionToken } from "../../utils/session.js";
import { getCatalogMedia } from "../../utils/catalog-media-storage.js";

export async function readMessageImageService(
  db: Kysely<DB>,
  id: string,
  sessionToken?: string,
  guestToken?: string,
  abortSignal?: AbortSignal,
) {
  const image = await findPrivateMessageImageData(db, id);

  if (!image || image.interpretation === null)
    return { kind: "not-found" as const };

  let allowed = false;

  if (sessionToken) {
    const resolved = await resolveSessionService(db, sessionToken);
    allowed =
      resolved.kind === "ok" &&
      (resolved.session.user.role === "admin" ||
        resolved.session.user.id === image.customer_id);
  }

  if (
    !allowed &&
    guestToken &&
    !image.customer_id &&
    image.guest_identity_id &&
    image.status === "active" &&
    image.guest_expires_at &&
    image.guest_expires_at.getTime() > Date.now()
  )
    allowed = await ownsMessageImageGuestData(
      db,
      image.guest_identity_id,
      hashSessionToken(guestToken),
    );

  if (!allowed) return { kind: "not-found" as const };

  try {
    const stream = await getCatalogMedia(
      image.storage_key,
      undefined,
      AbortSignal.any([
        AbortSignal.timeout(30_000),
        ...(abortSignal ? [abortSignal] : []),
      ]),
    );

    return {
      kind: "ok" as const,
      stream,
      mimeType: image.mime_type,
      byteSize: image.byte_size,
    };
  } catch {
    return { kind: "unavailable" as const };
  }
}
