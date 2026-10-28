# Client data and authentication

- `apps/web/src/components/app/data.ts` supplies demo bookings and navigation data. Package cards and admin catalog editing use `src/lib/api.ts` and the `/v1/packages` routes; customer and admin messages use the `/v1/messages` and `/v1/admin/conversations` routes. Inquiries, quotes, payments, and bookings still need persistence. Confirm the actual API boundary before claiming a workflow is end to end.
- `src/lib/api.ts` owns the current HTTP wrapper and endpoint calls. It sends cookies with `credentials: "include"` and accepts a Firebase token only for relevant identity exchanges. Match request/response changes to the API's `createRoute` schemas and `profile.ts` mapping.
- `src/lib/auth.tsx` owns `AuthProvider`, session restoration through `GET /me`, and sign-in/sign-out state. `src/lib/firebase.ts` configures optional Firebase browser sign-in with in-memory persistence. Read `AuthPage.tsx` and `SignInMethods.tsx` when changing login or linking UI.
- The database profile and role returned by the API determine whether the app shows the admin or customer area. UI state is not authorization; protected API operations must check access server-side.
- `PUBLIC_API_URL` and optional Firebase browser variables are described in `apps/web/.env.example`. Keep secret service-account values on the API side.

For auth changes, trace the user action through UI, client request, API route, session, and restored page state. Test failure paths as well as the successful path.
