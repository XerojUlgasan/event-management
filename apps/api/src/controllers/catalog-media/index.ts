import { OpenAPIHono, z } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { uploadCatalogMediaService, removePendingCatalogMediaService } from "../../services/catalog-media/catalog-media.js";
import { findPublicCatalogMediaData, findAdminCatalogMediaData, findCustomerCatalogMediaData } from "../../data/catalog-media/catalog-media.js";
import { getCatalogMedia } from "../../utils/catalog-media-storage.js";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE } from "../../utils/session.js";
import { resolveSessionService } from "../../services/auth/resolve-session.js";
import { mediaSchema } from "../packages/schemas.js";

const routes = new OpenAPIHono<HonoEnv>();
const uuid = z.string().uuid();
routes.use("/admin/catalog-media", requireSession, requireSystemAdmin);
routes.use("/admin/catalog-media/*", requireSession, requireSystemAdmin);
routes.openAPIRegistry.registerPath({ method: "post", path: "/admin/catalog-media", tags: ["Catalog media"], request: { body: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } } } }, responses: { 201: { description: "Pending media asset", content: { "application/json": { schema: mediaSchema } } }, 400: { description: "Invalid file" }, 401: { description: "Sign in required" }, 403: { description: "Admin required" }, 413: { description: "File too large" }, 502: { description: "Storage unavailable" } } });
routes.openAPIRegistry.registerPath({ method: "delete", path: "/admin/catalog-media/{id}", tags: ["Catalog media"], request: { params: z.object({ id: uuid }) }, responses: { 204: { description: "Discarded pending upload" }, 404: { description: "Not found" }, 409: { description: "Media is already saved" }, 502: { description: "Storage unavailable" } } });
routes.openAPIRegistry.registerPath({ method: "get", path: "/catalog-media/{id}", tags: ["Catalog media"], request: { params: z.object({ id: uuid }) }, responses: { 200: { description: "Published media stream" }, 206: { description: "Media byte range" }, 404: { description: "Not found" }, 416: { description: "Invalid range" }, 502: { description: "Storage unavailable" } } });
routes.post("/admin/catalog-media", async c => {
  let form: FormData;
  try { form = await c.req.raw.formData(); } catch { return c.json({ error: "Invalid multipart form." }, 400); }
  const file = form.get("file");
  if (!(file instanceof File) || form.getAll("file").length !== 1) return c.json({ error: "Choose one media file." }, 400);
  const result = await uploadCatalogMediaService(c.get("db"), c.get("session").user.id, file);
  return "status" in result ? c.json({ error: result.message }, result.status) : c.json(result, 201);
});
routes.delete("/admin/catalog-media/:id", async c => {
  const id = c.req.param("id");
  if (!uuid.safeParse(id).success) return c.json({ error: "Media not found." }, 404);
  const result = await removePendingCatalogMediaService(c.get("db"), id, c.get("session").user.id);
  return result ? c.json({ error: result.message }, result.status) : c.body(null, 204);
});
routes.get("/catalog-media/:id", async c => {
  const id = c.req.param("id");
  if (!uuid.safeParse(id).success) return c.json({ error: "Media not found." }, 404);
  let media = await findPublicCatalogMediaData(c.get("db"), id);
  let adminView = false;
  if (!media) {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) {
      const resolved = await resolveSessionService(c.get("db"), token);
      if (resolved.kind === "ok" && resolved.session.user.role === "admin" && resolved.session.user.staff_role === "System Administrator") {
        media = await findAdminCatalogMediaData(c.get("db"), id, resolved.session.user.id);
        adminView = !!media;
      } else if (resolved.kind === "ok" && resolved.session.user.role === "customer") {
        media = await findCustomerCatalogMediaData(c.get("db"), id, resolved.session.user.id);
        adminView = !!media;
      }
    }
  }
  if (!media?.storage_key || !media.mime_type || !media.byte_size) return c.json({ error: "Media not found." }, 404);
  const headers: Record<string, string> = { "Content-Type": media.mime_type, "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", "Cache-Control": adminView ? "private, no-store" : "public, max-age=300" };
  c.header("Cache-Control", headers["Cache-Control"]!);
  const requested = c.req.header("range");
  let range: string | undefined;
  if (requested) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(requested);
    const suffix = match && !match[1] ? Number(match[2]) : null;
    const start = suffix !== null ? Math.max(0, media.byte_size - suffix) : Number(match?.[1]);
    const end = suffix !== null || !match?.[2] ? media.byte_size - 1 : Math.min(Number(match[2]), media.byte_size - 1);
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= media.byte_size || end < start || suffix === 0) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${media.byte_size}` } });
    range = `bytes=${start}-${end}`;
    headers["Content-Range"] = `bytes ${start}-${end}/${media.byte_size}`;
    headers["Content-Length"] = String(end - start + 1);
  } else headers["Content-Length"] = String(media.byte_size);
  try {
    const object = await getCatalogMedia(media.storage_key, range);
    if (!object.Body) return c.json({ error: "Media not found." }, 404);
    return new Response(object.Body.transformToWebStream(), { status: range ? 206 : 200, headers });
  } catch { return c.json({ error: "Media unavailable. Try again." }, 502); }
});
export default routes;
