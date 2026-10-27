# Authentication and sessions

Current paths are registered in `apps/api/src/routes/auth/index.ts`. Read that file and the touched route before altering auth behavior.

- `requireFirebaseAuth` in `src/middleware/auth.ts` verifies Firebase ID tokens and places verified identity in the Hono context. Firebase is an identity proof for sign-in or linking; the database `users` row owns the application profile and role.
- `requireSession` reads the `em_session` cookie, hashes its token, loads the PostgreSQL session and user, and sets session context. `src/lib/session.ts` creates, rotates, expires, and clears sessions. Keep cookie and stored-session behavior aligned.
- `src/routes/auth/profile.ts` owns the API profile schema and row-to-response mapping. If the shape changes, update its actual browser consumer in `apps/web/src/lib/api.ts` and `apps/web/src/lib/auth.tsx`.
- Local password logic is in `src/routes/auth/password.ts` and `src/lib/password.ts`; Firebase setup is in `src/lib/firebase-admin.ts`; attempt limiting is in `src/lib/auth-limit.ts`. Inspect the full sign-in, linking, and logout flow before changing any one endpoint.
- Public registration creates customers. Roles come from database state; the browser must not assign or promote them. Matching email addresses do not automatically merge local and Firebase accounts.

The root README's Authentication and Session API sections document the current user-facing contract. Verify any changed claim against code and tests before updating that documentation.
