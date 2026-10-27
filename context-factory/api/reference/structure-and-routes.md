# API structure and routes

- `apps/api/src/index.ts` starts the Node server; `src/app.ts` builds the `OpenAPIHono<HonoEnv>` app, configures CORS and request guards, injects `db`, mounts route groups at `/v1`, and serves `/openapi.json`.
- `src/routes/<area>/index.ts` registers that area's routes and middleware. `src/routes/health/` and `src/routes/auth/` are the existing examples.
- Package catalog routes are in `src/routes/packages/`. Admins upload a JPEG or PNG through `POST /v1/admin/package-images`. `GET /v1/package-images/{id}` serves PostgreSQL bytes anonymously only when referenced by a current published version of a nonarchived package; admins can preview other stored images. Admins can delete unreferenced images via `DELETE /v1/admin/package-images/{id}`. The upload limit is 5 MiB, and package image URLs also accept external HTTP(S) URLs.
- Route files use `createRoute` from `@hono/zod-openapi` for method, path, request schema, and response schemas, then export an `AppRouteHandler<typeof route>` handler. Register both in the area's `index.ts`; mount a new area in `src/app.ts`.
- `src/types/hono.ts` defines the typed context variables. `src/middleware/` holds request auth middleware; `src/lib/` holds shared API helpers. Put new code where the existing flow places the same responsibility. There is no separate service layer to imitate yet.
- Validate incoming bodies through route schemas and read them with `c.req.valid("json")`. Keep documented OpenAPI responses consistent with actual handler status codes and response bodies.
- `src/app.ts` currently applies an allowed-origin check to browser POSTs and a 16 KiB limit to `/v1/auth/*`. Review those boundaries when adding write endpoints. Apply authorization on the server, not by hiding UI actions.

Check the affected route's OpenAPI output and behavior, especially if changing paths or response shapes consumed by `apps/web/src/lib/api.ts`.
