# Client data and authentication

Use [client layers](client-layers.md) for request placement and [API and type synchronization](../../contracts/references/api-type-sync.md) for payload changes. Trace affected data and permissions through current API schemas and consumers; the [root README](../../../../README.md#current-implementation) owns implementation status.

## Session lifecycle

`src/lib/auth/AuthProvider.tsx` restores the session via `/me`, revalidates on focus or visibility, and handles request `401`s. It distinguishes an expired session from invalid proof during account-method operations. A confirmed `401` clears the profile; other revalidation errors retain it and display a notice. Trace changes through `AuthPage.tsx`, `SignInMethods.tsx`, the API route, session, and return navigation; exercise failure as well as success paths.

The database role returned by the API determines workspace visibility. UI state is not authorization; protected API operations must enforce access. Optional Firebase sign-in uses browser-side in-memory persistence. Never expose API service-account secrets.

`pnpm dev` uses a same-origin `/v1` proxy for credentialed requests. Inspect `apps/web/astro.config.mjs`, environment examples, and the active target before changing origins or claiming browser authentication works.
