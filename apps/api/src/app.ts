import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "./db/client.js";
import healthRoutes from "./routes/health/index.js";
import type { HonoEnv } from "./types/hono.js";

export const app = new OpenAPIHono<HonoEnv>();

app.use("/v1/*", async (c, next) => {
  c.set("db", db);
  await next();
});

app.route("/v1", healthRoutes);

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Event Management API",
    version: "0.1.0",
  },
});
