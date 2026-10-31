# Shared limits

`packages/contracts` owns shared domain values. Import from its explicit subpath exports rather than duplicating numbers in API or browser code. API schemas remain authoritative for accepted values; client-side constraints and messages are hints that should match them.

| Import path | Export | Current value and scope |
| --- | --- | --- |
| `@event-management/contracts/limits/videos` | `MAX_VIDEO_SIZE_BYTES` | 25 MiB (`25 * 1024 * 1024`) constant only. There is no current video upload flow. |
| `@event-management/contracts/limits/messages` | `MAX_MESSAGE_BODY_LENGTH` | 4,000 characters per message body. |
| `@event-management/contracts/limits/booking-requests` | `MAX_EVENT_TYPE_LENGTH`, `MAX_TIME_ZONE_LENGTH`, `MAX_CONTACT_NAME_LENGTH`, `MAX_PHONE_NUMBER_LENGTH`, `MAX_PREFERRED_VENUE_LOCATION_LENGTH`, `MAX_SPECIAL_REQUESTS_LENGTH`, `MAX_BOOKING_REASON_LENGTH`, `BOOKING_ESTIMATED_DURATIONS` | Text limits are 200, 100, 200, 100, 1,000, 4,000, and 1,000 characters respectively. The booking reason limit is used for cancellation and status-change reasons. Estimated durations are `4_hours`, `8_hours`, `12_hours`, `1_day`, `2_days`, and `undecided`. |
| `@event-management/contracts/limits/venues` | `MAX_VENUE_PHOTOS` | Up to 10 photo references per venue. |
| `@event-management/contracts/limits/auth` | `MAX_EMAIL_LENGTH`, `MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_LENGTH`, `MAX_DISPLAY_NAME_LENGTH` | 254 characters, 8 characters, 128 characters, and 120 characters respectively. |
| `@event-management/contracts/limits/catalog` | `MAX_CATALOG_TEXT_LENGTH` | 4,000 characters for shared package, service, and venue catalog text fields. |

## API request-body caps

These are transport limits enforced only by the API in `apps/api/src/constants/http.ts` and `apps/api/src/app.ts`. They are not domain validation values.

| API constant | Current cap | Applied to |
| --- | --- | --- |
| `SMALL_JSON_BODY_LIMIT_BYTES` | 16 KiB | Auth, admin conversations, and booking-request API paths. |
| `CATALOG_JSON_BODY_LIMIT_BYTES` | 64 KiB | Admin package, service, and venue catalog JSON paths. |
| Inline message cap in `apps/api/src/app.ts` | 1 MiB | Customer message paths, including guest chat import. |
| Inline chatbot cap in `apps/api/src/app.ts` | 640 KiB | Guest chatbot requests. |

An API request can therefore be rejected by its total body size even when an individual field or file is within its domain limit. Browser hints do not replace server-side limits.

## Updating a value

1. Change the canonical constant in `packages/contracts/src/limits/<domain>.ts`. Add or change the matching explicit export in `packages/contracts/package.json` only when a new subpath is needed.
2. Update API schemas to consume the constant. Keep endpoint-specific parsing and checks in the API; do not move server HTTP body caps into the shared browser contract.
3. Update any web form constraints, helper text, or validation messages that mirror the value. Import the shared constant instead of copying it.
4. Update focused API behavior tests at both sides of a changed boundary. For text and count changes, cover the relevant route schema behavior.
5. Search repository guidance and product docs for the old value and update only statements affected by the change. Recheck links and report which API and browser behavior was actually verified.

The venue photo-count constant limits URL references. It does not establish an image storage provider or a video upload capability.
