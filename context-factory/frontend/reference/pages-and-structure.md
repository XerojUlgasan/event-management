# Pages and application structure

- `apps/web/src/pages/index.astro` serves `/`, imports `styles/app.css`, and mounts `components/app/App.tsx` as a React client-only island. The React app owns its current in-page view switching; there is no separate Astro file for each workspace view.
- `src/pages/landing.astro` serves `/landing`, imports `styles/global.css`, and mounts `LandingScene.tsx` for the 3D experience. Scene models live in `components/scene/EventModels.tsx`; `docs/LANDING.md` documents this page.
- `components/app/App.tsx` wires auth and selects public, sign-in, admin, or customer views. `AppShell.tsx`, `Sidebar.tsx`, `pages/`, and `customer/CustomerDashboard.tsx` contain the corresponding workspace UI.
- The admin sidebar includes Customers and Staffs. Both show sample directories with clickable rows and read-only detail drawers; neither directory is connected to a staff or customer management API.
- Both signed-in workspaces open Account settings from the user menu. The customer Messages view fills the area below the navigation bar, with separate conversation and thread panes on desktop and a list/thread switch on phones. Messages remain session-only demo content until a messaging API exists.
- Keep page-specific components and content in `apps/web`. Use `@event-management/ui` for reusable presentational components; consult the packages skill before changing that package.
- Check `docs/FEATURES.md` before implementing business workflows. Its first-release list is intended scope; current mock screens and demo data are not proof of backend implementation.
