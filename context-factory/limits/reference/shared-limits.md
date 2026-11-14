# Shared limits

`packages/contracts` owns shared domain values. Import from its explicit subpath exports rather than duplicating numbers in API or browser code. API schemas remain authoritative for accepted values; client-side constraints and messages are hints that should match them.

| Import path | Export | Current value and scope |
| --- | --- | --- |
| `@event-management/contracts/pagination` | `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `MAX_CURSOR_LENGTH` | Collection endpoints default to 15 rows, accept at most 50 rows per page, and reject cursors longer than 2,048 characters. This is a shared pagination contract, not a domain field or request-body limit. |
| `@event-management/contracts/limits/images` | `MAX_IMAGE_SIZE_BYTES` | 10 MiB (`10 * 1024 * 1024`) per uploaded catalog-canvas image. |
| `@event-management/contracts/limits/videos` | `QUOTATION_JSON_BODY_LIMIT_BYTES` | 2 MiB | Admin quotation JSON, including full ordered item lists. |
| `MAX_VIDEO_SIZE_BYTES` | 25 MiB (`25 * 1024 * 1024`) per uploaded catalog-canvas video. |
| `@event-management/contracts/limits/messages` | `MAX_MESSAGE_BODY_LENGTH` | 4,000 characters per message body. |
| `@event-management/contracts/limits/booking-requests` | `MAX_EVENT_TYPE_LENGTH`, `MAX_TIME_ZONE_LENGTH`, `MAX_CONTACT_NAME_LENGTH`, `MAX_PHONE_NUMBER_LENGTH`, `MAX_PREFERRED_VENUE_LOCATION_LENGTH`, `MAX_SPECIAL_REQUESTS_LENGTH`, `MAX_BOOKING_REASON_LENGTH`, `BOOKING_ESTIMATED_DURATIONS` | Text limits are 200, 100, 200, 100, 1,000, 4,000, and 1,000 characters respectively. The booking reason limit is used for cancellation and status-change reasons. `BOOKING_ESTIMATED_DURATIONS` remains the response vocabulary for historical estimate fields; new booking requests use `durationMode` and `requestedDays`. `one_day` requires one date and `multi_day` requires at least two distinct dates. Dates may be nonconsecutive; the API sorts them. No shared requested-day count constant is defined; the booking-request API's 16 KiB body cap still applies. |
| `@event-management/contracts/limits/auth` | `MAX_EMAIL_LENGTH`, `MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_LENGTH`, `MAX_DISPLAY_NAME_LENGTH` | 254 characters, 8 characters, 128 characters, and 120 characters respectively. |
| `@event-management/contracts/limits/catalog` | `MAX_CATALOG_TEXT_LENGTH`, `MAX_CATALOG_WIDGET_ROWS`, `MAX_CATALOG_WIDGET_Y` | 4,000 characters for catalog text; 100 rows per widget; maximum zero-based starting row of 100,000. API validation and editor controls consume the same limits. These do not define a fixed section row count. |
| `@event-management/contracts/event-checklists` | `MAX_CHECKLIST_TITLE_LENGTH`, `MAX_CHECKLIST_TEXT_LENGTH`, `MAX_CHECKLIST_TASKS` | 200 title characters, 4,000 characters per instructions/note, 100 tasks. Server task IDs and completion timestamps are outside editable task input. |
| `@event-management/contracts/event-days` | `RESPONSE_DEADLINE_DAYS`, `responseDeadlineForDay` | Shared event-day domain policy, not a transport or field-length limit: choose 1, 2, 3, or 4 calendar days before an event date; calculate 23:59:59.999 at the end of that date in the booking timezone. |

The reusable catalog contract in `@event-management/contracts/catalog` also limits package, service, and venue pages to 20 sections, 100 widgets, a 12-column layout, and 20,000 characters per Markdown widget. Each service and venue has one page in the current flat catalog schema.

## API request-body caps

These are transport limits enforced only by the API in `apps/api/src/constants/http.ts` and `apps/api/src/app.ts`. They are not domain validation values.

| API constant | Current cap | Applied to |
| --- | --- | --- |
| `SMALL_JSON_BODY_LIMIT_BYTES` | 16 KiB | Auth, customer/admin conversations, ordinary booking requests and customer quotation actions. |
| `CHECKLIST_JSON_BODY_LIMIT_BYTES` | 64 KiB | One task operation or send/create request on event-day checklist paths, in Node and Edge. |
| `CATALOG_JSON_BODY_LIMIT_BYTES` | 3 MiB | Admin package/service/venue catalog JSON and booking custom-package JSON. |
| `QUOTATION_JSON_BODY_LIMIT_BYTES` | 2 MiB | Admin quotation JSON, including full ordered item lists. |
| `MAX_VIDEO_SIZE_BYTES` + `MEDIA_UPLOAD_BODY_OVERHEAD_BYTES` | 25 MiB + 64 KiB | Multipart package-catalog media upload path (`/v1/admin/catalog-media`). Per-file image uploads remain limited to 10 MiB. |

An API request can therefore be rejected by its total body size even when an individual field or file is within its domain limit. Browser hints do not replace server-side limits.

## Updating a value

1. Change the canonical constant in `packages/contracts/src/limits/<domain>.ts`. Add or change the matching explicit export in `packages/contracts/package.json` only when a new subpath is needed.
2. Update API schemas to consume the constant. Keep endpoint-specific parsing and checks in the API; do not move server HTTP body caps into the shared browser contract.
3. Update any web form constraints, helper text, or validation messages that mirror the value. Import the shared constant instead of copying it.
4. Update focused API behavior tests at both sides of a changed boundary. For text and count changes, cover the relevant route schema behavior.
5. Search repository guidance and product docs for the old value and update only statements affected by the change. Recheck links and report which API and browser behavior was actually verified.

Catalog-canvas image and video uploads are stored in the private Supabase Storage bucket `event-management` at `catalog-media/<id>`; accepted file types and upload-only canvas rules are documented in the [catalog media reference](../../api/reference/external-image-urls.md). The shared file-size constants are separate from the API multipart body caps, which include allowance for form boundaries and headers.
