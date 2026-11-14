# Client layers

A screen calls a domain function in `src/lib/data/`; that function uses `request` in `src/lib/http/request.ts`. Browser transport is centralized there. The server-only catalog loader has its own fetch and must stay out of browser imports. Keep API validation, authorization, services, and SQL in `apps/api`.

## Placement

- One HTTP operation: `lib/data/<domain>/<responsibility>.ts`. Group related calls by responsibility; use existing domain files and kebab-case names.
- Multi-step browser work, storage, or response merging: `lib/services/`, such as catalog upload-then-save, a signed-out booking draft, and message-thread merge.
- Pure reusable conversion: `lib/utils/`; cursor history: `lib/pagination/`; session state: `lib/auth/AuthProvider.tsx`. Screens own composition, navigation, loading, error, and form state.
- `lib/data` may use HTTP and data helpers, but not screens, services, or utilities. Pure utilities do not import HTTP, storage, or React. Follow the [structure contract](project-structure.md) for boundaries.

## Request contract

`PUBLIC_API_URL` includes `/v1`, so pass paths after that prefix. `request(path, body?, idToken?, method?)` sends credentials, adds JSON content type except for `FormData`, and uses a bearer token only when supplied. An empty object posts; pass `"PATCH"` or `"DELETE"` as the fourth argument when needed. Encode path IDs. A `204` returns `undefined`; failures throw `ApiError`.

`request<T>` asserts a type rather than validating JSON. Compare route schemas, actual responses, handwritten DTOs, and consumers as described in [API and type synchronization](../../contracts/references/api-type-sync.md). Use shared catalog, pagination, and limit exports where applicable. Treat pagination cursors as opaque and scoped to their owner and filters; inspect the actual route rather than assuming every endpoint shares a limit or response shape.

Handle visible failures with `useNotifications().notifyError(cause, fallback)` and retain useful inline feedback. Report success after the write resolves. Polling callers suppress identical failures until recovery; `AuthProvider` owns authentication failure notices. Demo data is not evidence of persisted behavior.
