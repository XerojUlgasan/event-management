import { messageBodyLimit } from "../constants/http.js";
import { env } from "../utils/env.js";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { MAX_VIDEO_SIZE_BYTES } from "@event-management/contracts/limits/videos";
import {
  CATALOG_JSON_BODY_LIMIT_BYTES,
  MEDIA_UPLOAD_BODY_OVERHEAD_BYTES,
  SMALL_JSON_BODY_LIMIT_BYTES,
  bookingBodyLimit,
} from "../constants/http.js";
import type { HonoEnv } from "../types/hono.js";
import {
  matchRouteFamily,
  routeFamilies,
  type RouteFamilyId,
} from "./match-route.js";

const allowedOrigins = env.WEB_ORIGINS;

const loaders = {
  "message-images": () => import("../controllers/message-images/index.js"),
  "guest-chat": () => import("../controllers/guest-chat/index.js"),
  ai: () => import("../controllers/ai/index.js"),
  health: () => import("../controllers/health/index.js"),
  "catalog-media": () => import("../controllers/catalog-media/index.js"),
  services: () => import("../controllers/services/index.js"),
  packages: () => import("../controllers/packages/index.js"),
  "booking-requests": () => import("../controllers/booking-requests/index.js"),
  "event-days": () => import("../controllers/event-days/index.js"),
  messages: () => import("../controllers/messages/index.js"),
  auth: () => import("../controllers/auth/index.js"),
  users: () => import("../controllers/users/index.js"),
} satisfies Record<
  RouteFamilyId,
  () => Promise<{ default: OpenAPIHono<HonoEnv> }>
>;

const bodyLimits: Partial<
  Record<RouteFamilyId, ReadonlyArray<{ path: string; maxSize: number }>>
> = {
  "guest-chat": [{ path: "/guest/*", maxSize: SMALL_JSON_BODY_LIMIT_BYTES }],
  ai: [
    {
      path: "/admin/ai/knowledge/search",
      maxSize: SMALL_JSON_BODY_LIMIT_BYTES,
    },
    {
      path: "/admin/ai/knowledge/index",
      maxSize: SMALL_JSON_BODY_LIMIT_BYTES,
    },
  ],
  "event-days": [
    { path: "/admin/event-days", maxSize: SMALL_JSON_BODY_LIMIT_BYTES },
    { path: "/admin/event-days/*", maxSize: SMALL_JSON_BODY_LIMIT_BYTES },
  ],
  auth: [{ path: "/auth/*", maxSize: SMALL_JSON_BODY_LIMIT_BYTES }],
  messages: [
    { path: "/messages/*", maxSize: SMALL_JSON_BODY_LIMIT_BYTES },
    { path: "/admin/conversations/*", maxSize: SMALL_JSON_BODY_LIMIT_BYTES },
  ],
  packages: [
    { path: "/admin/packages", maxSize: CATALOG_JSON_BODY_LIMIT_BYTES },
    { path: "/admin/packages/*", maxSize: CATALOG_JSON_BODY_LIMIT_BYTES },
  ],
  services: [
    { path: "/admin/services", maxSize: CATALOG_JSON_BODY_LIMIT_BYTES },
    { path: "/admin/services/*", maxSize: CATALOG_JSON_BODY_LIMIT_BYTES },
  ],
  "catalog-media": [
    {
      path: "/admin/catalog-media",
      maxSize: MAX_VIDEO_SIZE_BYTES + MEDIA_UPLOAD_BODY_OVERHEAD_BYTES,
    },
  ],
  "booking-requests": [
    { path: "/booking-requests", maxSize: SMALL_JSON_BODY_LIMIT_BYTES },
    { path: "/booking-requests/*", maxSize: SMALL_JSON_BODY_LIMIT_BYTES },
    { path: "/quotations/*", maxSize: SMALL_JSON_BODY_LIMIT_BYTES },
  ],
};

const familyApps = new Map<RouteFamilyId, Promise<OpenAPIHono<HonoEnv>>>();

let documentationApp: Promise<OpenAPIHono<HonoEnv>> | undefined;

function remember<T>(load: () => Promise<T>, drop: () => void) {
  const pending = load().catch((error: unknown) => {
    drop();
    throw error;
  });

  return pending;
}

async function createFamilyApp(id: RouteFamilyId) {
  const [{ default: routes }, { db }] = await Promise.all([
    loaders[id](),
    import("../db/client.js"),
  ]);
  const family = new OpenAPIHono<HonoEnv>();
  family.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.set("db", db);
    await next();
  });

  for (const limit of bodyLimits[id] ?? [])
    family.use(limit.path, (c, next) =>
      bodyLimit({
        maxSize:
          id === "messages" || id === "guest-chat"
            ? messageBodyLimit(c.req.path, c.req.header("content-type"))
            : limit.maxSize,
      })(c, next),
    );

  if (id === "booking-requests")
    family.use("/admin/booking-requests/*", (c, next) =>
      bodyLimit({ maxSize: bookingBodyLimit(c.req.path) })(c, next),
    );

  family.route("/", routes);

  return family;
}

function loadFamily(id: RouteFamilyId) {
  const cached = familyApps.get(id);

  if (cached) return cached;

  const pending = remember(
    () => createFamilyApp(id),
    () => familyApps.delete(id),
  );

  familyApps.set(id, pending);

  return pending;
}

function loadDocumentation() {
  if (documentationApp) return documentationApp;

  documentationApp = remember(
    async () => {
      const docs = new OpenAPIHono<HonoEnv>();

      for (const family of routeFamilies) {
        const { default: routes } = await loaders[family.id]();
        docs.route("/v1", routes);
      }

      docs.doc("/openapi.json", {
        openapi: "3.0.0",
        info: { title: "Event Management API", version: "0.1.0" },
      });

      return docs;
    },
    () => {
      documentationApp = undefined;
    },
  );

  return documentationApp;
}

function stripMountPrefix(request: Request) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/v1(?=\/|$)/, "") || "/";

  return new Request(url, request);
}

export const app = new OpenAPIHono<HonoEnv>();

app.use(
  "*",
  cors({
    origin: (origin) =>
      origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    credentials: true,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use("/v1/*", async (c, next) => {
  const origin = c.req.header("origin");

  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method) &&
    origin &&
    !allowedOrigins.includes(origin)
  ) {
    return c.json({ error: "Origin is not allowed" }, 403);
  }

  await next();
});

app.all("/openapi.json", (c) =>
  loadDocumentation().then((docs) => docs.fetch(c.req.raw)),
);

app.all("/v1/*", async (c) => {
  const family = matchRouteFamily(c.req.path);

  if (!family) return c.notFound();

  const familyApp = await loadFamily(family);

  return familyApp.fetch(stripMountPrefix(c.req.raw));
});
