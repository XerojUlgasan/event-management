# Shared limits

`packages/contracts` owns shared domain values. Import from its explicit subpath exports rather than duplicating numbers in API or browser code. API schemas remain authoritative for accepted values; client-side constraints and messages are hints that should match them.

| Import path | Export | Current value and scope |
| --- | --- | --- |
| `@event-management/contracts/pagination` | `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `MAX_CURSOR_LENGTH` | Collection endpoints default to 15 rows, accept at most 50 rows per page, and reject cursors longer than 2,048 characters. This is a shared pagination contract, not a domain field or request-body limit. |
| `@event-management/contracts/limits/images` | `MAX_IMAGE_SIZE_BYTES` | 10 MiB (`10 * 1024 * 1024`) per uploaded catalog-canvas image. |
| `@event-management/contracts/limits/videos` | `MAX_VIDEO_SIZE_BYTES` | 25 MiB (`25 * 1024 * 1024`) per uploaded catalog-canvas video. |
| `@event-management/contracts/limits/messages` | `MAX_MESSAGE_BODY_LENGTH` | 4,000 characters per message body. |
| `@event-management/contracts/limits/messages` | `MAX_MESSAGE_IMAGES`, `MAX_MESSAGE_IMAGE_PIXELS` | Four images per conversation message, each limited to 16 megapixels; the shared 10 MiB image limit also applies to each file. |
| `@event-management/contracts/limits/booking-requests` | `MAX_EVENT_TYPE_LENGTH`, `MAX_TIME_ZONE_LENGTH`, `MAX_CONTACT_NAME_LENGTH`, `MAX_PHONE_NUMBER_LENGTH`, `MAX_PREFERRED_VENUE_LOCATION_LENGTH`, `MAX_SPECIAL_REQUESTS_LENGTH`, `MAX_BOOKING_REASON_LENGTH`, `MAX_BOOKING_ADDON_HOURS`, `BOOKING_ESTIMATED_DURATIONS` | Text limits are 200, 100, 200, 100, 1,000, 4,000, and 1,000 characters respectively. Requested add-on coverage is limited to 2,147,483,647 whole hours. Historical estimate fields retain `BOOKING_ESTIMATED_DURATIONS`. New requests use `durationMode` and `requestedDays`. `one_day` requires one date and `multi_day` requires at least two distinct dates. Dates may be nonconsecutive. The API sorts them within the create-route body limit. |
| `@event-management/contracts/booking-draft` | `bookingDraftFieldsSchema`, `bookingDraftPatchSchema` | Conversational intake accepts up to 366 distinct dates and 100 requested services. It reuses the booking text limits, including 200 characters for budget and 4,000 for special requests and per-service notes. |
| `@event-management/contracts/limits/auth` | `MAX_EMAIL_LENGTH`, `MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_LENGTH`, `MAX_DISPLAY_NAME_LENGTH` | 254 characters, 8 characters, 128 characters, and 120 characters respectively. |
| `@event-management/contracts/limits/catalog` | `MAX_CATALOG_TEXT_LENGTH`, `MAX_CATALOG_SEARCH_LENGTH`, `MAX_CATALOG_WIDGET_ROWS`, `MAX_CATALOG_WIDGET_Y` | 4,000 characters for catalog text; 200 characters for picker search; 100 rows per widget; maximum zero-based starting row of 100,000. API validation and editor controls consume the same limits. These do not define a fixed section row count. |

The reusable catalog contract in `@event-management/contracts/catalog` also limits each package or service canvas to 20 sections, 100 widgets, and 20,000 characters per Markdown widget. A section with `columns: 24` uses a 24-column layout. An omitted column count identifies a legacy 12-column section. Sections and widgets are arrays inside the owning `packages.canvas` or `services.canvas` JSONB column, not separate catalog page rows. The runtime schemas exported from `@event-management/contracts/catalog-canvas` enforce document rules in the editor, API, stored-document readers/writers, and seed writers. `draftSectionsSchema(pendingWidgetIds)` accepts a missing upload ID only for a widget with a pending file; the complete `sectionsSchema` is checked again after upload. `storedSectionsSchema` validates the persisted `mediaId` shape. Database functions do not validate canvas documents after migration `20261116090100_validate_catalog_canvas_in_app`.

## API request-body caps

The business-profile schema and its constants are exported from `@event-management/contracts/business-information`: `MAX_BUSINESS_SHORT_TEXT` (200), `MAX_BUSINESS_TEXT` (4,000), `MAX_BUSINESS_URL` (2,048), `MAX_BUSINESS_LINKS` (20), and `MAX_BUSINESS_FAQS` (30). Email reuses `MAX_EMAIL_LENGTH` (254). Text is trimmed; URLs require HTTP or HTTPS without embedded credentials. The same schema validates API input, stored JSON, and browser data. These bounds describe the complete stored profile even when a view displays a smaller selection of fields.

These are transport limits enforced only by the API in `apps/api/src/constants/http.ts` and `apps/api/src/app.ts`. They are not domain validation values.

| API constant | Current cap | Applied to |
| --- | --- | --- |
| `BUSINESS_INFORMATION_JSON_BODY_LIMIT_BYTES` | 2 MiB | Admin business-information saves at `/v1/admin/business-information`, in both Node and Edge. The cap accommodates bounded profile text and FAQs after UTF-8 encoding and JSON escaping. |
| `SMALL_JSON_BODY_LIMIT_BYTES` | 16 KiB | Auth, customer/admin conversations, booking request updates, and customer quotation actions. |
| `BOOKING_CREATE_JSON_BODY_LIMIT_BYTES` | 64 KiB | Submitting a booking request with service selections and UTF-8 request notes. Applies to Node and Edge. |
| `CATALOG_JSON_BODY_LIMIT_BYTES` | 3 MiB | Admin package/service catalog JSON and booking custom-package JSON. |
| `QUOTATION_JSON_BODY_LIMIT_BYTES` | 2 MiB | Admin quotation JSON, including full ordered item lists. |
| `MAX_VIDEO_SIZE_BYTES` + `MEDIA_UPLOAD_BODY_OVERHEAD_BYTES` | 25 MiB + 64 KiB | Multipart package-catalog media upload path (`/v1/admin/catalog-media`). Per-file image uploads remain limited to 10 MiB. |
| `MESSAGE_UPLOAD_BODY_LIMIT_BYTES` | 40 MiB + 64 KiB | Multipart customer, admin, and guest message sends only. Text JSON and other conversation routes retain the 16 KiB cap. Both Node and Edge select the cap by route and content type. |

An API request can therefore be rejected by its total body size even when an individual field or file is within its domain limit. Browser hints do not replace server-side limits.

## Updating a value

1. Change the canonical constant in `packages/contracts/src/limits/<domain>.ts`. Add or change the matching explicit export in `packages/contracts/package.json` only when a new subpath is needed.
2. Update API schemas to consume the constant. Keep endpoint-specific parsing and checks in the API; do not move server HTTP body caps into the shared browser contract.
3. Update any web form constraints, helper text, or validation messages that mirror the value. Import the shared constant instead of copying it.
4. Update focused API behavior tests at both sides of a changed boundary. For text and count changes, cover the relevant route schema behavior.
5. Search repository guidance and product docs for the old value and update only statements affected by the change. Recheck links and report which API and browser behavior was actually verified.

Catalog-canvas image and video uploads are stored in the private Supabase Storage bucket `event-management` under pending and owner-specific package/service/booking folders; accepted file types and upload-only canvas rules are documented in the [catalog media reference](../../api/references/external-image-urls.md). The shared file-size constants are separate from the API multipart body caps, which include allowance for form boundaries and headers.
