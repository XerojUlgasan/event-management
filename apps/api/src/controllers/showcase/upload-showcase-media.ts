import { createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { uploadShowcaseMediaService } from "../../services/showcase/upload-showcase-media.js";

const mediaResponseSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["image", "video"]),
  source: z.literal("upload"),
  url: z.string(),
  mimeType: z.string(),
});

export const uploadShowcaseMediaRoute = createRoute({
  method: "post",
  path: "/admin/showcase-media",
  tags: ["Showcase"],
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["file"],
            properties: { file: { type: "string", format: "binary" } },
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: "Uploaded media asset",
      content: { "application/json": { schema: mediaResponseSchema } },
    },
    400: { description: "Invalid file" },
    401: { description: "Sign in required" },
    403: { description: "Admin required" },
    413: { description: "File too large" },
    502: { description: "Storage unavailable" },
  },
});

export const uploadShowcaseMediaRouteHandler: AppRouteHandler<
  typeof uploadShowcaseMediaRoute
> = async (c) => {
  let form: FormData;

  try {
    form = await c.req.raw.formData();
  } catch {
    return c.json({ error: "Invalid multipart form." }, 400);
  }

  const file = form.get("file");

  if (!(file instanceof File) || form.getAll("file").length !== 1)
    return c.json({ error: "Choose one media file." }, 400);

  const result = await uploadShowcaseMediaService(
    c.get("db"),
    c.get("session").user.id,
    file,
  );

  return "status" in result
    ? c.json({ error: result.message }, result.status)
    : c.json(result, 201);
};
