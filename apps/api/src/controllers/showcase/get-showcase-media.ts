import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import {
  findPublicShowcaseMediaData,
  findAdminShowcaseMediaData,
} from "../../data/showcase-records/find-public-showcase-media.js";
import { getCatalogMedia } from "../../utils/catalog-media-storage.js";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE } from "../../utils/session.js";
import { resolveSessionService } from "../../services/auth/resolve-session.js";
import { idParams } from "./schemas.js";

export const getShowcaseMediaRoute = createRoute({
  method: "get",
  path: "/showcase-media/{id}",
  tags: ["Showcase"],
  request: { params: idParams },
  responses: {
    200: { description: "Media stream" },
    206: { description: "Media byte range" },
    404: { description: "Not found" },
    416: { description: "Invalid range" },
    502: { description: "Storage unavailable" },
  },
});

export const getShowcaseMediaRouteHandler: AppRouteHandler<
  typeof getShowcaseMediaRoute
> = async (c) => {
  const id = c.req.valid("param").id;

  // Try public visibility first (no auth).
  let media = await findPublicShowcaseMediaData(c.get("db"), id);
  let adminView = false;

  // Fall back to admin visibility if a valid admin session exists.
  if (!media) {
    const token = getCookie(c, SESSION_COOKIE);

    if (token) {
      const resolved = await resolveSessionService(c.get("db"), token);

      if (resolved.kind === "ok" && resolved.session.user.role === "admin") {
        media = await findAdminShowcaseMediaData(
          c.get("db"),
          id,
          resolved.session.user.id,
        );
        adminView = !!media;
      }
    }
  }

  if (!media) return c.json({ error: "Media not found." }, 404);

  // Recheck publication before serving a URL that was public on a previous read.
  const cacheControl = adminView ? "private, no-store" : "no-cache";
  c.header("Cache-Control", cacheControl);

  // Sample assets have a plain url and no storage_key — redirect to it.
  if (!media.storage_key) {
    if (media.url) return c.redirect(media.url, 302);

    return c.json({ error: "Media not found." }, 404);
  }

  if (!media.mime_type || !media.byte_size)
    return c.json({ error: "Media not found." }, 404);

  const headers: Record<string, string> = {
    "Content-Type": media.mime_type,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
  };

  const requested = c.req.header("range");
  let range: string | undefined;

  if (requested) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(requested);
    const suffix = match && !match[1] ? Number(match[2]) : null;
    const start =
      suffix !== null
        ? Math.max(0, media.byte_size - suffix)
        : Number(match?.[1]);
    const end =
      suffix !== null || !match?.[2]
        ? media.byte_size - 1
        : Math.min(Number(match[2]), media.byte_size - 1);

    if (
      !match ||
      (!match[1] && !match[2]) ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= media.byte_size ||
      end < start ||
      suffix === 0
    )
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${media.byte_size}` },
      });

    range = `bytes=${start}-${end}`;
    headers["Content-Range"] = `bytes ${start}-${end}/${media.byte_size}`;
    headers["Content-Length"] = String(end - start + 1);
  } else {
    headers["Content-Length"] = String(media.byte_size);
  }

  try {
    const body = await getCatalogMedia(media.storage_key, range);

    return new Response(body, { status: range ? 206 : 200, headers });
  } catch {
    return c.json({ error: "Media unavailable. Try again." }, 502);
  }
};
