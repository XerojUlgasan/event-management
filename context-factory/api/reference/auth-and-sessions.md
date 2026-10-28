# Authentication and sessions

Current paths are registered in `apps/api/src/controllers/auth/index.ts`. Read that file and the touched operation before altering auth behavior.

- `requireFirebaseAuth` in `src/middleware/auth.ts` verifies Firebase ID tokens and places verified identity in the Hono context. Firebase is an identity proof for sign-in or linking; the database `users` row owns the application profile and role.
- `requireSession` reads the `em_session` cookie and calls `src/services/auth/resolve-session.ts`. Session and user queries live in focused files under `src/data/auth/`. `src/utils/session.ts` owns token hashing, TTL, and cookie primitives; `src/services/auth/start-session.ts` creates and rotates sessions. Keep cookie and stored-session behavior aligned.
- `src/controllers/auth/profile.ts` owns the API profile schema and row-to-response mapping. If the shape changes, update its browser consumers in `apps/web/src/lib/api.ts` and `apps/web/src/lib/auth.tsx`.
- `src/controllers/auth/register-user.ts`, `login-user.ts`, `sync-firebase-profile.ts`, `link-firebase.ts`, and `add-password.ts` define the HTTP contracts. Corresponding service and data operation files own the business checks and Kysely queries. Password hashing is in `src/utils/password.ts`, Firebase setup in `src/utils/firebase-admin.ts`, and attempt limiting in `src/utils/auth-limit.ts`.
- Public registration creates customers. Roles come from database state; the browser must not assign or promote them. Matching email addresses do not automatically merge local and Firebase accounts.

The root README's Authentication and Session API sections document the current user-facing contract. Verify any changed claim against code and tests before updating that documentation.
