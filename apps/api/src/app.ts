import { SMALL_JSON_BODY_LIMIT_BYTES, CATALOG_JSON_BODY_LIMIT_BYTES, IMAGE_UPLOAD_BODY_LIMIT_BYTES } from "./constants/http.js";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { db } from "./db/client.js";
import bookingRequestRoutes from "./controllers/booking-requests/index.js";
import authRoutes from "./controllers/auth/index.js";
import chatbotRoutes from "./controllers/chatbot/index.js";
import messageRoutes from "./controllers/messages/index.js";
import serviceRoutes from "./controllers/services/index.js";
import packageRoutes from "./controllers/packages/index.js";
import venueRoutes from "./controllers/venues/index.js";
import healthRoutes from "./controllers/health/index.js";
import userRoutes from "./controllers/users/index.js";
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
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use("/v1/*", async (c, next) => {
  const origin = c.req.header("origin");
  if (["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method) && origin && !allowedOrigins.includes(origin)) {
    return c.json({ error: "Origin is not allowed" }, 403);
  }
  c.header("Cache-Control", "no-store");
  c.set("db", db);
  await next();
});

app.use("/v1/auth/*", bodyLimit({ maxSize: SMALL_JSON_BODY_LIMIT_BYTES }));
app.use("/v1/messages/*", bodyLimit({ maxSize: 1024 * 1024 }));
app.use("/v1/admin/conversations/*", bodyLimit({ maxSize: SMALL_JSON_BODY_LIMIT_BYTES }));
app.use("/v1/chatbot/*", bodyLimit({ maxSize: 640 * 1024 }));

app.use("/v1/admin/packages/*", bodyLimit({ maxSize: CATALOG_JSON_BODY_LIMIT_BYTES }));
app.use("/v1/admin/packages", bodyLimit({ maxSize: CATALOG_JSON_BODY_LIMIT_BYTES }));
app.use("/v1/admin/venues", bodyLimit({ maxSize: CATALOG_JSON_BODY_LIMIT_BYTES }));
app.use("/v1/admin/venues/*", bodyLimit({ maxSize: CATALOG_JSON_BODY_LIMIT_BYTES }));
app.use("/v1/admin/venue-images", bodyLimit({ maxSize: IMAGE_UPLOAD_BODY_LIMIT_BYTES }));
app.use("/v1/admin/package-images", bodyLimit({ maxSize: IMAGE_UPLOAD_BODY_LIMIT_BYTES }));

app.route("/v1", healthRoutes);
app.use("/v1/admin/service-images", bodyLimit({ maxSize: IMAGE_UPLOAD_BODY_LIMIT_BYTES }));
app.use("/v1/admin/services", bodyLimit({ maxSize: CATALOG_JSON_BODY_LIMIT_BYTES }));
app.use("/v1/admin/services/*", bodyLimit({ maxSize: CATALOG_JSON_BODY_LIMIT_BYTES }));
app.route("/v1", serviceRoutes);
app.route("/v1", packageRoutes);
app.route("/v1", venueRoutes);
app.use("/v1/booking-requests", bodyLimit({ maxSize: SMALL_JSON_BODY_LIMIT_BYTES }));
app.use("/v1/booking-requests/*", bodyLimit({ maxSize: SMALL_JSON_BODY_LIMIT_BYTES }));
app.use("/v1/admin/booking-requests/*", bodyLimit({ maxSize: SMALL_JSON_BODY_LIMIT_BYTES }));
app.route("/v1", bookingRequestRoutes);
app.route("/v1", messageRoutes);
app.route("/v1", chatbotRoutes);
app.route("/v1", authRoutes);
app.route("/v1", userRoutes);

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Event Management API",
    version: "0.1.0",
  },
});
