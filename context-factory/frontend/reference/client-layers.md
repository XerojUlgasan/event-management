# Client layers

`apps/web` does not copy `apps/api`'s controllers, services, and data folders. The API uses those layers for HTTP validation, business rules, and SQL. The website calls that API. A screen imports a domain function from `src/lib/data/`. That function calls `request` in `src/lib/http.ts`. `fetch` appears only in `http.ts`.

There is no `apps/web/src/controllers` folder and no `src/lib/api.ts` barrel. Do not add either. Do not add a second fetch wrapper, and do not add a browser file for each API controller, service, or SQL module.

## What talks to the API

Private proposal reads/saves and audit history live in `lib/data/booking-packages.ts`; quotation reads and admin draft/save/send/revision calls live in `lib/data/quotations.ts`. Customers discuss quotations through the existing message calls. Reuse the shared quotation/catalog contracts. Message DTOs include a nullable quotation reference; render the exact referenced version through the authorized quotation endpoint rather than treating message text as an offer or resolving the latest version silently.

`request` in `apps/web/src/lib/http.ts` builds the URL from `PUBLIC_API_URL`, which already ends in `/v1`. Pass the path after that prefix, such as `/packages` or `/admin/packages`. The wrapper sends `credentials: "include"`. It sets `Content-Type: application/json` unless the body is `FormData`. It sends `Authorization: Bearer` only when the caller passes an identity token, which current auth exchanges do for Firebase. A failed response throws `ApiError`. A `204` response returns `undefined`. `request<T>` asserts the JSON type. It does not check that the server returned `T`. Compare a changed payload with the route schema, as [API synchronization](../../shared/api-type-sync.md) describes.

`apiBase()` resolves a relative `PUBLIC_API_URL` against the page origin in the browser. `pnpm dev` sets that value to `/v1` and proxies it. See [client data and authentication](data-and-auth.md) for the proxy reason and the variable names in `apps/web/.env.example`.

Domain modules under `apps/web/src/lib/data/` are the functions screens use for `/v1`. Each function chooses the path, method, and body.

| Module | Responsibility |
| --- | --- |
| `auth.ts` | Login, registration, `GET /me`, logout, and the Firebase sync, link, and password exchanges |
| `packages.ts` | Public and admin package reads, create, update, archive, and delete |
| `services.ts` | Public and admin service reads, create, update, archive, and delete |
| `venues.ts` | Public and admin venue reads, create, update, archive, and delete |
| `catalog-media.ts` | Admin catalog upload and delete, plus resolving a stored media path to a browser URL |
| `messages.ts` | Customer and admin conversation reads and sends |
| `booking-requests.ts` | Customer and admin booking-request reads, create, per-day time saves, cancel and status update, plus admin date counts and filtered pages |
| `users.ts` | Admin user directory read |
| `event-days.ts` | Admin event-day reads and team operations, request-level deadline application that creates requested-date days and updates current scheduled deadlines from one 1–4-day choice, legacy manual creation and move/reopen deadline choices, staff availability responses, and own assignments |
| `event-checklists.ts` | Admin draft/read/edit/send and coordinator read/task operations, all with shared checklist contracts and revision guards |
| `page-query.ts` | Catalog `limit`, `cursor`, `search`, and `archived` query string. It performs no HTTP |

Paged API calls pass an optional `limit` and opaque `cursor`; the server defaults omitted limits to 15 and caps them at 50. Each endpoint returns its named collection array with `nextCursor`, which is `null` on the last page. Do not parse, edit, or reuse a cursor across a different owner, parent, or filter scope. The shared types and constants are exported from `@event-management/contracts/pagination`; the API owns the query schema and cursor validation.

Call shape on `request(path, body?, idToken?, method?)`:

- GET: `request(path)` when there is no body.
- POST: `request(path, body)`. An empty object still posts.
- PATCH: `request(path, body, undefined, "PATCH")`.
- DELETE: `request(path, undefined, undefined, "DELETE")`.
- Bearer token: pass the token as the third argument.

Encode ids in the path with `encodeURIComponent`. Package content types come from `@event-management/contracts/catalog`. Other response types in these files are handwritten. A shared limit used by a form comes from `@event-management/contracts/limits/*`. The API schema still decides what is accepted.

`lib/data` may import `http.ts` and other data helpers such as `page-query.ts` and `catalog-media.ts`. It does not import screens, `lib/services`, or `lib/utils`.

## Where other client code goes

| Kind of code | Owner | Current examples |
| --- | --- | --- |
| One HTTP operation | `src/lib/data/<domain>.ts` | `createPackage`, `getMe`, `uploadCatalogMedia` |
| More than one client step, browser storage, or combining responses without a new route | `src/lib/services/` | `uploadPendingCatalogMedia` calls `uploadCatalogMedia` for each pending file. `booking-draft.ts` stores a signed-out inquiry, including date mode, date rows, and timezone, in `sessionStorage`. `mergeThread` keeps a message that a poll started before the send has not returned yet |
| Pure conversion with no network and no storage | `src/lib/utils/` | `pesosToCentavos`, `centavosToPesos`, `initialsFromName`, `firstName` |
| Cursor history for a paged view | `src/lib/use-pagination.ts` | `usePagination(scope)` tracks the current cursor and Previous/Next page index for one list scope; changing scope starts at page one. It does not fetch data |
| Signed-in React state | `src/lib/auth.tsx` | `AuthProvider` and `useAuth` call `lib/data/auth.ts` for sign-in, sign-out, and session restore. A screen may still call `getMe` when it needs a fresh profile, as the public booking dialog does |
| Firebase browser SDK | `src/lib/firebase.ts` | Optional Google and Firebase password sign-in. Identity still reaches the API through `lib/data/auth.ts` |
| Screen composition, navigation, and view state | `src/components/` | Pages import the data or service function they need and keep loading, error, and form state local |
| Demo navigation and sample rows | `src/components/app/data.ts` | Sidebar keys and sample bookings. This file is not an API client |

A service may import `lib/data`. A util does not import HTTP, storage, or React. Demo data in `components/app/data.ts` is not proof that a screen is persisted. [Client data and authentication](data-and-auth.md) records which flows call the API.

## Add a call

1. Use the existing domain file when the route belongs to that API domain. Add `src/lib/data/<domain>.ts` when the domain is new. Name the file for the domain, in kebab-case when it has more than one word, as `booking-requests.ts` does.
2. Export a camelCase function named for the operation, such as `getAdminPackages` or `updateBookingRequestStatus`.
3. Call `request` with the path after `/v1`. Keep the function a direct call. Put upload-then-save, drafts, and response merging in `src/lib/services/`, in a file named for that sequence.
4. Import the data function from the screen, or from the service when the screen should not sequence the calls. Catch `ApiError` in the screen that shows the message and call the shared `useNotifications().notifyError(cause, fallback)`. This formats and displays the failure and returns its message for optional inline error state. Keep useful inline validation or retry controls. Report success after the write resolves. Polling callers suppress identical failures until recovery; the HTTP wrapper does not emit notifications. `AuthProvider` owns authentication failure notices, so auth screens do not duplicate them.
5. When the route shape changes, update the handwritten type and every caller in the same change. Do not treat `request<T>` as a generated client.

Put a new pure helper in `src/lib/utils/` when more than one screen needs it or when it matches the money and name helpers. Leave a one-off JSX detail in the component.

The database profile returned by `GET /me` chooses the System Administrator, staff, or customer area. Hiding a control is not authorization. The API route still checks access.
