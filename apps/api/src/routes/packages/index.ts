import { randomUUID } from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { hashSessionToken, SESSION_COOKIE } from "../../lib/session.js";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { adminSchema, contentSchema, errorSchema, publicSchema } from "./schemas.js";
import { adminDto, columns, complete, imageExists, lockImages, lockPackage, nextUpdate, publicDto, publicRows, removeUnusedImage } from "./store.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success) return c.json({ error: result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") }, 400);
  },
});
const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });
const errors = {
  400: { content: json(errorSchema), description: "Invalid package data" },
  401: { content: json(errorSchema), description: "Not signed in" },
  403: { content: json(errorSchema), description: "Admin access required" },
  404: { content: json(errorSchema), description: "Package not found" },
  409: { content: json(errorSchema), description: "Package state conflict" },
};
const idParams = z.object({ id: z.string().uuid() });
const body = <T extends z.ZodType>(schema: T) => ({ required: true as const, content: json(schema) });
const result = { content: json(adminSchema), description: "Package with versions" };
const error = (message: string, status: 400 | 404 | 409) => ({ message, status });
const admin = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "admin") return c.json({ error: "Admin access required" }, 403);
  await next();
});
routes.use("/admin/packages", requireSession, admin);
routes.use("/admin/packages/*", requireSession, admin);
routes.use("/admin/package-images", requireSession, admin);
routes.use("/admin/package-images/*", requireSession, admin);

const uploadImage = createRoute({ method: "post", path: "/admin/package-images", tags: ["Packages"], request: {
  body: { required: true, content: { "multipart/form-data": { schema: z.object({ image: z.any().openapi({ type: "string", format: "binary" }) }) } } },
}, responses: {
  201: { content: json(z.object({ imageUrl: z.string() })), description: "Uploaded image" },
  400: errors[400], 401: errors[401], 403: errors[403], 413: { description: "Image exceeds the upload limit" },
} });
routes.openapi(uploadImage, async c => {
  const image = c.req.valid("form").image;
  if (!(image instanceof File) || image.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(image.type)) {
    return c.json({ error: "Choose a JPEG or PNG image up to 5 MiB" }, 400);
  }
  const data = Buffer.from(await image.arrayBuffer());
  const jpeg = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const contentType = jpeg ? "image/jpeg" : png ? "image/png" : null;
  if (!contentType || image.type !== contentType) {
    return c.json({ error: "Image content does not match its type" }, 400);
  }
  const row = await c.get("db").insertInto("package_images").values({ content_type: contentType, data }).returning("id").executeTakeFirstOrThrow();
  return c.json({ imageUrl: `/v1/package-images/${row.id}` }, 201);
});

const getImage = createRoute({ method: "get", path: "/package-images/{id}", tags: ["Packages"], request: { params: idParams }, responses: {
  200: { content: { "image/jpeg": { schema: z.string().openapi({ format: "binary" }) }, "image/png": { schema: z.string().openapi({ format: "binary" }) } }, description: "Package image" },
  400: errors[400], 404: errors[404],
} });
routes.openapi(getImage, async c => {
  const db = c.get("db");
  const id = c.req.valid("param").id.toLowerCase();
  const published = await db.selectFrom("package_versions as v").innerJoin("packages as p", "p.id", "v.package_id").select("v.id")
    .where("v.image_url", "=", `/v1/package-images/${id}`).where("v.state", "=", "published").where("p.archived_at", "is", null).executeTakeFirst();
  if (!published) {
    const token = getCookie(c, SESSION_COOKIE);
    const adminSession = token && await db.selectFrom("sessions as s").innerJoin("users as u", "u.id", "s.user_id").select("s.id")
      .where("s.token_hash", "=", hashSessionToken(token)).where("s.expires_at", ">", new Date()).where("u.role", "=", "admin").executeTakeFirst();
    if (!adminSession) return c.json({ error: "Image not found" }, 404);
  }
  const row = await db.selectFrom("package_images").select(["data", "content_type"]).where("id", "=", id).executeTakeFirst();
  if (!row) return c.json({ error: "Image not found" }, 404);
  return c.body(new Uint8Array(row.data), 200, { "Content-Type": row.content_type, "X-Content-Type-Options": "nosniff" });
});

const deleteImage = createRoute({ method: "delete", path: "/admin/package-images/{id}", tags: ["Packages"], request: { params: idParams }, responses: {
  204: { description: "Unreferenced image deleted" }, ...errors,
} });
routes.openapi(deleteImage, async c => {
  const id = c.req.valid("param").id.toLowerCase();
  const url = `/v1/package-images/${id}`;
  const outcome = await c.get("db").transaction().execute(async trx => {
    await lockImages(trx, [url]);
    if (!await imageExists(trx, url)) return error("Image not found", 404);
    if (!await removeUnusedImage(trx, url)) return error("Image is referenced by a package version", 409);
    return null;
  });
  if (outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.body(null, 204);
});

const listPublic = createRoute({ method: "get", path: "/packages", tags: ["Packages"], responses: {
  200: { content: json(z.object({ packages: z.array(publicSchema) })), description: "Published packages" },
} });
routes.openapi(listPublic, async c => c.json({ packages: (await publicRows(c.get("db"))).map(publicDto) }, 200));
const getPublic = createRoute({ method: "get", path: "/packages/{id}", tags: ["Packages"], request: { params: idParams }, responses: {
  200: { content: json(publicSchema), description: "Published package" }, ...errors,
} });
routes.openapi(getPublic, async c => {
  const row = (await publicRows(c.get("db"), c.req.valid("param").id))[0];
  return row ? c.json(publicDto(row), 200) : c.json({ error: "Package not found" }, 404);
});
const listAdmin = createRoute({ method: "get", path: "/admin/packages", tags: ["Packages"], responses: {
  200: { content: json(z.object({ packages: z.array(adminSchema) })), description: "Packages" }, ...errors,
} });
routes.openapi(listAdmin, async c => {
  const db = c.get("db");
  const rows = await db.selectFrom("packages").selectAll().orderBy("created_at", "desc").execute();
  return c.json({ packages: await Promise.all(rows.map(row => adminDto(db, row))) }, 200);
});
const getAdmin = createRoute({ method: "get", path: "/admin/packages/{id}", tags: ["Packages"], request: { params: idParams }, responses: { 200: result, ...errors } });
routes.openapi(getAdmin, async c => {
  const db = c.get("db");
  const row = await db.selectFrom("packages").selectAll().where("id", "=", c.req.valid("param").id).executeTakeFirst();
  return row ? c.json(await adminDto(db, row), 200) : c.json({ error: "Package not found" }, 404);
});
const create = createRoute({ method: "post", path: "/admin/packages", tags: ["Packages"], request: { body: body(contentSchema) }, responses: { 201: result, ...errors } });
routes.openapi(create, async c => {
  const data = c.req.valid("json");
  if (data.guestMin > data.guestMax) return c.json({ error: "Minimum guests must not exceed maximum guests" }, 400);
  const db = c.get("db");
  const value = await db.transaction().execute(async trx => {
    await lockImages(trx, [data.imageUrl]);
    if (!await imageExists(trx, data.imageUrl)) return error("Uploaded image not found", 400);
    const pkg = await trx.insertInto("packages").values({ id: randomUUID() }).returningAll().executeTakeFirstOrThrow();
    await trx.insertInto("package_versions").values({ package_id: pkg.id, version: 1, state: "draft", ...columns(data) }).execute();
    return adminDto(trx, pkg);
  });
  if ("status" in value) return c.json({ error: value.message }, value.status);
  return c.json(value, 201);
});
const edit = createRoute({ method: "patch", path: "/admin/packages/{id}/draft", tags: ["Packages"], request: { params: idParams, body: body(contentSchema.extend({ expectedUpdatedAt: z.string().datetime() })) }, responses: { 200: result, ...errors } });
routes.openapi(edit, async c => {
  const data = c.req.valid("json");
  if (data.guestMin > data.guestMax) return c.json({ error: "Minimum guests must not exceed maximum guests" }, 400);
  const db = c.get("db");
  const outcome = await db.transaction().execute(async trx => {
    const pkg = await lockPackage(trx, c.req.valid("param").id);
    if (!pkg) return error("Package not found", 404);
    if (pkg.archived_at) return error("Archived packages cannot be edited", 409);
    const current = await trx.selectFrom("package_versions").selectAll().where("package_id", "=", pkg.id).where("state", "in", ["draft", "published"]).orderBy("version", "desc").executeTakeFirst();
    if (!current || current.updated_at.toISOString() !== data.expectedUpdatedAt) return error("Package changed. Refresh and try again", 409);
    await lockImages(trx, [current.image_url, data.imageUrl]);
    if (!await imageExists(trx, data.imageUrl)) return error("Uploaded image not found", 400);
    const updatedAt = nextUpdate(current.updated_at);
    if (current.state === "draft") await trx.updateTable("package_versions").set({ ...columns(data), updated_at: updatedAt }).where("id", "=", current.id).execute();
    else await trx.insertInto("package_versions").values({ package_id: pkg.id, version: current.version + 1, state: "draft", updated_at: updatedAt, ...columns(data) }).execute();
    if (current.state === "draft") await removeUnusedImage(trx, current.image_url);
    await trx.updateTable("packages").set({ updated_at: updatedAt }).where("id", "=", pkg.id).execute();
    return adminDto(trx, pkg);
  });
  if ("status" in outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.json(outcome, 200);
});
const publish = createRoute({ method: "post", path: "/admin/packages/{id}/publish", tags: ["Packages"], request: { params: idParams, body: body(z.object({ expectedUpdatedAt: z.string().datetime() })) }, responses: { 200: result, ...errors } });
routes.openapi(publish, async c => {
  const db = c.get("db");
  const outcome = await db.transaction().execute(async trx => {
    const pkg = await lockPackage(trx, c.req.valid("param").id);
    if (!pkg) return error("Package not found", 404);
    if (pkg.archived_at) return error("Archived packages cannot be published", 409);
    const draft = await trx.selectFrom("package_versions").selectAll().where("package_id", "=", pkg.id).where("state", "=", "draft").executeTakeFirst();
    if (!draft) return error("No draft to publish", 409);
    if (draft.updated_at.toISOString() !== c.req.valid("json").expectedUpdatedAt) return error("Package changed. Refresh and try again", 409);
    if (!complete(draft)) return error("Complete all package details and set a fixed PHP price before publishing", 400);
    const now = nextUpdate(draft.updated_at);
    await trx.updateTable("package_versions").set({ state: "superseded" }).where("package_id", "=", pkg.id).where("state", "=", "published").execute();
    await trx.updateTable("package_versions").set({ state: "published", published_at: now, updated_at: now }).where("id", "=", draft.id).execute();
    const updated = await trx.updateTable("packages").set({ updated_at: now }).where("id", "=", pkg.id).returningAll().executeTakeFirstOrThrow();
    return adminDto(trx, updated);
  });
  if ("status" in outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.json(outcome, 200);
});
const archive = createRoute({ method: "post", path: "/admin/packages/{id}/archive", tags: ["Packages"], request: { params: idParams }, responses: { 200: result, ...errors } });
routes.openapi(archive, async c => {
  const db = c.get("db");
  const outcome = await db.transaction().execute(async trx => {
    const pkg = await lockPackage(trx, c.req.valid("param").id);
    if (!pkg) return error("Package not found", 404);
    const updated = await trx.updateTable("packages").set({ archived_at: pkg.archived_at ?? new Date(), updated_at: new Date() }).where("id", "=", pkg.id).returningAll().executeTakeFirstOrThrow();
    return adminDto(trx, updated);
  });
  if ("status" in outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.json(outcome, 200);
});
const remove = createRoute({ method: "delete", path: "/admin/packages/{id}", tags: ["Packages"], request: { params: idParams }, responses: { 204: { description: "Deleted" }, ...errors } });
routes.openapi(remove, async c => {
  const db = c.get("db");
  let outcome;
  try {
    outcome = await db.transaction().execute(async trx => {
      const pkg = await lockPackage(trx, c.req.valid("param").id);
      if (!pkg) return error("Package not found", 404);
      const published = await trx.selectFrom("package_versions").select("id").where("package_id", "=", pkg.id).where("published_at", "is not", null).executeTakeFirst();
      if (published) return error("Published packages cannot be deleted; archive instead", 409);
      const versions = await trx.selectFrom("package_versions").select("image_url").where("package_id", "=", pkg.id).execute();
      await lockImages(trx, versions.map(version => version.image_url));
      await trx.deleteFrom("packages").where("id", "=", pkg.id).execute();
      for (const version of versions) await removeUnusedImage(trx, version.image_url);
      return null;
    });
  } catch (cause) {
    if ((cause as { code?: string }).code === "23503") return c.json({ error: "Referenced packages cannot be deleted; archive instead" }, 409);
    throw cause;
  }
  if (outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.body(null, 204);
});
export default routes;
