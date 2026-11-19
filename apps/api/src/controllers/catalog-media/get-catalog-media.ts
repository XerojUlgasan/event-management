import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { findPublicCatalogMediaData } from "../../data/catalog-media/find-public-catalog-media.js";
import { findCustomerCatalogMediaData } from "../../data/catalog-media/find-customer-catalog-media.js";
import { findAdminCatalogMediaData } from "../../data/catalog-media/find-admin-catalog-media.js";
import { readCatalogMediaService } from "../../services/catalog-media/read-catalog-media.js";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE } from "../../utils/session.js";
import { resolveSessionService } from "../../services/auth/resolve-session.js";
import { idParams } from "./schemas.js";

export const getCatalogMediaRoute = createRoute({
  method: "get",
  path: "/catalog-media/{id}",
  tags: ["Catalog media"],
  request: { params: idParams },
  responses: {
    200: { description: "Published media stream" },
    206: { description: "Media byte range" },
    404: { description: "Not found" },
    416: { description: "Invalid range" },
    502: { description: "Storage unavailable" },
  },
});

export const getCatalogMediaRouteHandler: AppRouteHandler<
  typeof getCatalogMediaRoute
> = async (c) => {
  const id = c.req.valid("param").id;
  let media = await findPublicCatalogMediaData(c.get("db"), id);
  let adminView = false;

  if (!media) {
    const token = getCookie(c, SESSION_COOKIE);

    if (token) {
      const resolved = await resolveSessionService(c.get("db"), token);

      if (resolved.kind === "ok" && resolved.session.user.role === "admin") {
        media = await findAdminCatalogMediaData(
          c.get("db"),
          id,
          resolved.session.user.id,
        );
        adminView = !!media;
      } else if (
        resolved.kind === "ok" &&
        resolved.session.user.role === "customer"
      ) {
        media = await findCustomerCatalogMediaData(
          c.get("db"),
          id,
          resolved.session.user.id,
        );
        adminView = !!media;
      }
    }
  }

  if (!media?.storage_key || !media.mime_type || !media.byte_size)
    return jsonError(c, "Media not found.", 404);

  const headers: Record<string, string> = {
    "Content-Type": media.mime_type,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Cache-Control": adminView ? "private, no-store" : "public, max-age=300",
  };
  c.header("Cache-Control", headers["Cache-Control"]!);
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
  } else headers["Content-Length"] = String(media.byte_size);

  try {
    const body = await readCatalogMediaService(
      c.get("db"),
      id,
      media.storage_key,
      range,
    );

    return new Response(body, { status: range ? 206 : 200, headers });
  } catch {
    return jsonError(c, "Media unavailable. Try again.", 502);
  }
};
