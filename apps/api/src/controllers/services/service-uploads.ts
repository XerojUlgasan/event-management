import { randomUUID } from "node:crypto";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { HonoEnv } from "../../types/hono.js";
import { contentSchema } from "./schemas.js";
import { createServiceService } from "../../services/services/create-service.js";
import { editServiceDraftService } from "../../services/services/edit-service-draft.js";
import { deleteServiceImage, detectServiceImageType, getServiceImage, putServiceImage } from "../../utils/service-image-storage.js";

const uuid = z.string().uuid();
const uploadContent = contentSchema.omit({ imageId: true }).strict();
export async function serviceUploadHandler(c: Context<HonoEnv>) {
  const id = c.req.param("id");
  if (id && !uuid.safeParse(id).success) return c.json({ error: "Invalid service id" }, 400);
  let form: FormData;
  try { form = await c.req.raw.formData(); } catch { return c.json({ error: "Invalid multipart form" }, 400); }
  const content = form.get("content");
  const image = form.get("image");
  if (typeof content !== "string" || !(image instanceof File) || form.getAll("content").length !== 1 || form.getAll("image").length !== 1) return c.json({ error: "A content field and image file are required" }, 400);
  let raw: unknown;
  try { raw = JSON.parse(content); } catch { return c.json({ error: "Invalid content JSON" }, 400); }
  const parsed = (id ? uploadContent.extend({ expectedUpdatedAt: z.string().datetime() }) : uploadContent).safeParse(raw);
  if (!parsed.success) return c.json({ error: "Invalid service content" }, 400);
  if (image.size > MAX_IMAGE_SIZE_BYTES) return c.json({ error: "Image exceeds 10 MiB" }, 413);
  const bytes = new Uint8Array(await image.arrayBuffer());
  const contentType = detectServiceImageType(bytes);
  if (!contentType || image.type !== contentType) return c.json({ error: "Image must be a JPEG, PNG, or WebP file" }, 400);
  const imageId = randomUUID();
  try { await putServiceImage(imageId, bytes, contentType); } catch { return c.json({ error: "Image upload failed" }, 502); }
  try {
    if (id) {
      const result = await editServiceDraftService(c.get("db"), id, parsed.data as typeof parsed.data & { expectedUpdatedAt: string }, imageId);
      if ("status" in result) { await deleteServiceImage(imageId).catch(() => {}); return c.json({ error: result.message }, result.status); }
      return c.json(result, 200);
    }
    const result = await createServiceService(c.get("db"), { ...parsed.data, imageId });
    return c.json(result, 201);
  } catch (err) {
    await deleteServiceImage(imageId).catch(() => {});
    throw err;
  }
}
export async function serviceImageHandler(c: Context<HonoEnv>) {
  const id = c.req.param("id");
  if (!id || !uuid.safeParse(id).success) return c.json({ error: "Image not found" }, 404);
  try {
    const object = await getServiceImage(id);
    if (!object.Body || !["image/jpeg", "image/png", "image/webp"].includes(object.ContentType ?? "")) return c.json({ error: "Image not found" }, 404);
    const bytes = await object.Body.transformToByteArray();
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": object.ContentType!, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch (err) {
    if (typeof err === "object" && err !== null && "$metadata" in err && (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return c.json({ error: "Image not found" }, 404);
    return c.json({ error: "Image unavailable" }, 502);
  }
}
