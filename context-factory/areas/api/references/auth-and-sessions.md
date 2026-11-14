# Authentication and sessions

Current paths are registered in `apps/api/src/controllers/auth/index.ts`. Read that file and the touched operation before altering auth behavior.

- `requireFirebaseAuth` in `src/middleware/auth.ts` verifies Firebase ID tokens and places verified identity in the Hono context. Firebase is an identity proof for sign-in or linking; the database `users` row owns the application profile and role.
- `requireSession` reads the `em_session` cookie and calls `src/services/auth/resolve-session.ts`. Session and user queries live in focused files under `src/data/auth/`. `src/utils/session.ts` owns token hashing, TTL, and cookie primitives; `src/services/auth/start-session.ts` creates and rotates sessions. Keep cookie and stored-session behavior aligned.
- `src/controllers/auth/profile.ts` owns the API profile schema and row-to-response mapping. If the shape changes, update its browser consumers in `apps/web/src/lib/data/auth/session.ts` and `apps/web/src/lib/auth/AuthProvider.tsx`.
- `src/controllers/auth/register-user.ts`, `login-user.ts`, `sync-firebase-profile.ts`, `link-firebase.ts`, and `add-password.ts` define the HTTP contracts. Corresponding service and data operation files own the business checks and Kysely queries. Password hashing is in `src/utils/password.ts`, Firebase setup in `src/utils/firebase-admin.ts`, and attempt limiting in `src/utils/auth-limit.ts`.
- The only account roles are `customer` and `admin`. Public registration creates customers; admin access is limited to designated System Administrators. Roles come from database state; the browser must not assign or promote them. Matching email addresses do not automatically merge local and Firebase accounts. When the catalog/staff removal migration converts accounts to customers, it revokes their existing sessions.
- Password hashing uses `hash-wasm` Argon2id so the same helper works in Node and Supabase Edge without native bindings. Preserve the encoded hash parameters and timing-safe digest comparison when changing verification; existing native-generated Argon2id hashes must still authenticate. `test:password` covers synthetic legacy fixtures and `test:auth` covers login with a persisted legacy hash. `test:edge` requires the current bundle to be served locally and exercises the actual Edge runtime.

Auth field bounds are shared through `@event-management/contracts/limits/auth`; consult the [shared limits guidance](../../contracts/SKILL.md) when changing API schemas or client hints.

The root README's [Authentication section](../../../../README.md#authentication) documents sign-in and session behavior; the running API's `/openapi.json` provides route contracts. Verify any changed claim against code and tests before updating that documentation.
