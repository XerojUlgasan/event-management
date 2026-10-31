import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body } from "./http.js";
import { uploadVenueImageService } from "../../services/venues/upload-venue-image.js";
import sharp from "sharp";

export const uploadVenueImageRoute = createRoute({ method: "post", path: "/admin/venue-images", tags: ["Venues"], request: {
  body: { required: true, content: { "multipart/form-data": { schema: z.object({ image: z.any().openapi({ type: "string", format: "binary" }) }) } } },
}, responses: {
  201: { content: json(z.object({ imageUrl: z.string() })), description: "Uploaded image" },
  400: errors[400], 401: errors[401], 403: errors[403], 413: { description: "Image exceeds the upload limit" },
} });
export const uploadVenueImageRouteHandler: AppRouteHandler<typeof uploadVenueImageRoute> = async c => {
  const image = c.req.valid("form").image;
  if (!(image instanceof File) || image.size > MAX_IMAGE_SIZE_BYTES || !["image/jpeg", "image/png"].includes(image.type)) {
    return c.json({ error: "Choose a JPEG or PNG image up to 10 MiB" }, 400);
  }
  const data = Buffer.from(await image.arrayBuffer());
  try {
    const decoder = sharp(data, { limitInputPixels: 40_000_000, failOn: "error" });
    const metadata = await decoder.metadata();
    const contentType = metadata.format === "jpeg" ? "image/jpeg" : metadata.format === "png" ? "image/png" : null;
    if (!contentType || contentType !== image.type) throw new Error("Image type mismatch");
    await decoder.stats();
  } catch {
    return c.json({ error: "Choose a valid JPEG or PNG image up to 10 MiB" }, 400);
  }
  return c.json({ imageUrl: await uploadVenueImageService(c.get("db"), image.type, data) }, 201);
};
