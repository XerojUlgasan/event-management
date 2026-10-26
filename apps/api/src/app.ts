import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { db } from "./db/client.js";
import authRoutes from "./routes/auth/index.js";
import healthRoutes from "./routes/health/index.js";
import type { HonoEnv } from "./types/hono.js";

export const app = new OpenAPIHono<HonoEnv>();

const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:4321")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  "*",
  cors({
    origin: (origin) =>
      origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    credentials: true,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use("/v1/*", async (c, next) => {
  c.set("db", db);
  await next();
});

app.route("/v1", healthRoutes);
app.route("/v1", authRoutes);

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Event Management API",
    version: "0.1.0",
  },
});
