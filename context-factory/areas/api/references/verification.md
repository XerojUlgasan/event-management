# API verification

Choose the relevant suite from `apps/api/package.json` and inspect its setup and teardown before running it. API integration suites generally create and drop disposable migrated PostgreSQL databases; auth additionally requires the Firebase emulator. Confirm the actual target and prerequisites first.

- Auth and session changes: `test:auth`; password compatibility: `test:password`; actual local Edge behavior: `test:edge` with the current bundle served.
- Booking requests, event-day schedules, packages/media, messages, or quotations: the matching `test:booking-requests`, `test:event-days`, `test:packages`, `test:messages`, or `test:quotations` suite. Catalog/staff removal, role conversion, and access changes: inspect `test:catalog-staff-removal`, `test:rls`, and relevant migration tests. Checklist schema/data removal: `test:checklist-removal`.
- Type and schema checks: `pnpm --filter @event-management/api check` and `pnpm db:validate` as applicable.

Test observable responses, authorization and error paths, persisted effects, and rollback where relevant. The package suite's fake Storage API does not prove live Supabase Storage. Role-specific RLS checks may skip if Supabase roles are absent. A type check, in-process Edge test, or disposable database does not establish browser or hosted-provider behavior; report the boundary exercised.
