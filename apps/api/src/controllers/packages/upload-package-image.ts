import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body } from "./http.js";
import { uploadPackageImageService } from "../../services/packages/upload-package-image.js";
import { InvalidImageError } from "../../utils/upload-image-to-r2.js";

export const uploadPackageImageRoute = createRoute({ method: "post", path: "/admin/package-images", tags: ["Packages"], request: {
  body: { required: true, content: { "multipart/form-data": { schema: z.object({ image: z.any().openapi({ type: "string", format: "binary" }) }) } } },
}, responses: {
  201: { content: json(z.object({ imageUrl: z.string() })), description: "Uploaded image" },
  400: errors[400], 401: errors[401], 403: errors[403], 413: { description: "Image exceeds the upload limit" },
} });
export const uploadPackageImageRouteHandler: AppRouteHandler<typeof uploadPackageImageRoute> = async c => {
  const image = c.req.valid("form").image;
  if (!(image instanceof File) || image.size > MAX_IMAGE_SIZE_BYTES || !["image/jpeg", "image/png"].includes(image.type)) {
    return c.json({ error: "Choose a JPEG or PNG image up to 10 MiB" }, 400);
  }
  const data = Buffer.from(await image.arrayBuffer());
  const jpeg = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const contentType = jpeg ? "image/jpeg" : png ? "image/png" : null;
  if (!contentType || image.type !== contentType) {
    return c.json({ error: "Image content does not match its type" }, 400);
  }
  try {
    return c.json({ imageUrl: await uploadPackageImageService(c.get("db"), contentType, data) }, 201);
  } catch (cause) {
    if (cause instanceof InvalidImageError) return c.json({ error: cause.message }, 400);
    throw cause;
  }
};
