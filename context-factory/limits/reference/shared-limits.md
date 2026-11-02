# Shared limits

`packages/contracts` owns shared domain values. Import from its explicit subpath exports rather than duplicating numbers in API or browser code. API schemas remain authoritative for accepted values; client-side constraints and messages are hints that should match them.

| Import path | Export | Current value and scope |
| --- | --- | --- |
| `@event-management/contracts/limits/images` | `MAX_IMAGE_SIZE_BYTES` | 10 MiB (`10 * 1024 * 1024`) per uploaded catalog-canvas image or legacy service image. |
| `@event-management/contracts/limits/videos` | `MAX_VIDEO_SIZE_BYTES` | 25 MiB (`25 * 1024 * 1024`) per uploaded catalog-canvas video. |
| `@event-management/contracts/limits/messages` | `MAX_MESSAGE_BODY_LENGTH` | 4,000 characters per message body. |
| `@event-management/contracts/limits/booking-requests` | `MAX_EVENT_TYPE_LENGTH`, `MAX_TIME_ZONE_LENGTH`, `MAX_CONTACT_NAME_LENGTH`, `MAX_PHONE_NUMBER_LENGTH`, `MAX_PREFERRED_VENUE_LOCATION_LENGTH`, `MAX_SPECIAL_REQUESTS_LENGTH`, `MAX_BOOKING_REASON_LENGTH`, `BOOKING_ESTIMATED_DURATIONS` | Text limits are 200, 100, 200, 100, 1,000, 4,000, and 1,000 characters respectively. The booking reason limit is used for cancellation and status-change reasons. Accepted durations are historical `4_hours`, `8_hours`, `12_hours`, plus `1_day` through `6_days`, `1_week`, `more_than_1_week`, and `undecided`. New forms show the day and week choices; `more_than_1_week` also requires an exact day count of at least 8. |
| `@event-management/contracts/limits/venues` | `MAX_VENUE_PHOTOS` | Up to 10 legacy HTTPS photo URL references per venue; canvas widgets use the catalog-page limits. |
| `@event-management/contracts/limits/auth` | `MAX_EMAIL_LENGTH`, `MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_LENGTH`, `MAX_DISPLAY_NAME_LENGTH` | 254 characters, 8 characters, 128 characters, and 120 characters respectively. |
| `@event-management/contracts/limits/catalog` | `MAX_CATALOG_TEXT_LENGTH` | 4,000 characters for shared package, service, and venue catalog text fields. |

The reusable catalog contract in `@event-management/contracts/catalog` also limits package, service, and venue pages to 20 sections, 100 widgets, a 12-column layout, and 20,000 characters per Markdown widget. Each service and venue has one page in the current flat catalog schema.

## API request-body caps

These are transport limits enforced only by the API in `apps/api/src/constants/http.ts` and `apps/api/src/app.ts`. They are not domain validation values.

| API constant | Current cap | Applied to |
| --- | --- | --- |
| `SMALL_JSON_BODY_LIMIT_BYTES` | 16 KiB | Auth, customer and admin conversations, and booking-request API paths. |
| `CATALOG_JSON_BODY_LIMIT_BYTES` | 3 MiB | Admin package, service, and venue catalog JSON paths. |
| `MAX_VIDEO_SIZE_BYTES` + `SERVICE_UPLOAD_BODY_OVERHEAD_BYTES` | 25 MiB + 64 KiB | Multipart package-catalog media upload path (`/v1/admin/catalog-media`). Per-file image uploads remain limited to 10 MiB. |
| `MAX_IMAGE_SIZE_BYTES` + `SERVICE_UPLOAD_BODY_OVERHEAD_BYTES` | 10 MiB + 64 KiB | Multipart service image upload paths. |

An API request can therefore be rejected by its total body size even when an individual field or file is within its domain limit. Browser hints do not replace server-side limits.

## Updating a value

1. Change the canonical constant in `packages/contracts/src/limits/<domain>.ts`. Add or change the matching explicit export in `packages/contracts/package.json` only when a new subpath is needed.
2. Update API schemas to consume the constant. Keep endpoint-specific parsing and checks in the API; do not move server HTTP body caps into the shared browser contract.
3. Update any web form constraints, helper text, or validation messages that mirror the value. Import the shared constant instead of copying it.
4. Update focused API behavior tests at both sides of a changed boundary. For text and count changes, cover the relevant route schema behavior.
5. Search repository guidance and product docs for the old value and update only statements affected by the change. Recheck links and report which API and browser behavior was actually verified.

The venue photo-count constant limits URL references. Catalog-canvas image and video uploads are stored in R2; accepted file types and upload-only canvas rules are documented in the [catalog media reference](../../api/reference/external-image-urls.md). The shared file-size constants are separate from the API multipart body caps, which include allowance for form boundaries and headers.
