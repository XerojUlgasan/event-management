import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import type { HonoEnv } from "../../types/hono.js";
import { SESSION_COOKIE } from "../../utils/session.js";
import { GUEST_COOKIE } from "../../utils/guest-chat.js";
import { readMessageImageService } from "../../services/messages/read-message-image.js";

const routes = new OpenAPIHono<HonoEnv>();

const route = createRoute({
  method: "get",
  path: "/message-images/{id}",
  tags: ["Messages"],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Private message image" },
    404: { description: "Image not found" },
    502: { description: "Image unavailable" },
  },
});

routes.openapi(route, async (c) => {
  const result = await readMessageImageService(
    c.get("db"),
    c.req.valid("param").id,
    getCookie(c, SESSION_COOKIE),
    getCookie(c, GUEST_COOKIE),
    c.req.raw.signal,
  );

  if (result.kind === "not-found")
    return c.json({ error: "Image not found" }, 404);

  if (result.kind === "unavailable")
    return c.json({ error: "Image is unavailable" }, 502);

  c.header("Cache-Control", "private, no-store");

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Length": String(result.byteSize),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export default routes;
