# API structure and routes

Inspect the affected route, service, data query, tests, and callers for the current contract. The business references and root README describe product behavior; `/openapi.json` and source establish current HTTP behavior.

## Ownership

- `apps/api/src/index.ts` starts Node; `src/app.ts` builds the Hono app, configures request guards, injects the database, mounts `/v1`, and exposes OpenAPI. Check the Edge dispatcher when changing route registration; Node and Edge must mount the intended operation.
- `controllers/<domain>/index.ts` registers routes and middleware. Operation files define the OpenAPI route and handler; use `c.req.valid("json")` for validated JSON and keep declared responses aligned with actual bodies and statuses.
- `services/<domain>/` owns business rules and transactions; `data/<domain>/` owns focused Kysely queries taking a database client or transaction. A simple operation need not introduce unnecessary layers. `src/db/` owns shared connection and generated table types.
- Use kebab-case operation files, such as `create-package.ts`, with `createPackageRoute` and `createPackageRouteHandler` in the controller, `createPackageService` in services, and `createPackageData` in data when those layers are needed. Register domain routes in `controllers/<domain>/index.ts`. Shared request middleware lives in `src/middleware/`; transport caps belong to `src/constants/http.ts`, while shared domain limits belong to contracts.

## Environment configuration

[`src/utils/env.ts`](../../../../apps/api/src/utils/env.ts) owns typed environment reads, defaults, and configuration parsing for Node, Edge, Prisma, seeds, and the local cleanup script. Consumers import `env`; retain existing initialization timing when choosing when to read its getters. Optional Firebase and Storage settings are checked when used. Keep dotenv loading at the existing entry points; the Edge build replaces `dotenv/config` with an empty module. `pnpm check:env` detects raw env reads outside designated app owners, excluding tests and generated bundles.

## Cross-domain safeguards

- Requested-day scheduling and event-day create/move/cancel routes are registered through the event-day router; quotation routes through the booking-request router. Check both the router and operation middleware before assuming ordinary booking-read access grants administrative access.
- Booking inquiry snapshots and a private proposal have separate owners. Conversations do not expire automatically; existing closed booking threads retain their status. Read the affected [business reference](../../../business/README.md) and current service before altering these flows.
- When changing a browser-facing route, follow [API and type synchronization](../../contracts/references/api-type-sync.md); inspect response and permission/error paths as well as OpenAPI.
