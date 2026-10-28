# Landing page implementation

The public `/landing` route implements the approved minimal Clemora direction: pale lilac-gray canvas, ink typography, restrained coral accents, generous space, and one interactive event still life. The `/` route hosts the React public site and workspaces.

## Structure

- `apps/web/src/pages/landing.astro` contains the landing content and local navigation anchors.
- `apps/web/src/styles/landing.css` contains page layout and responsive behavior.
- `apps/web/src/components/LandingScene.tsx` mounts a client-only React Three Fiber canvas, detects WebGL support, and handles pointer drag, scroll progress, and reduced motion.
- `apps/web/src/components/scene/EventModels.tsx` draws the chair, table, flowers, and photo booth with local Three.js geometry. No remote model or image service is required.
- `packages/theme/src/theme.css` holds the new visual tokens. `packages/ui/src` holds the reusable wordmark, action link, section counter, site header, and inclusion strip.

## Behavior

Drag the 3D composition horizontally to rotate it. Scrolling through the sticky opening section changes the object's arrangement and reveals the second line of copy. The navigation scrolls to sections on the landing page. The mobile navigation uses native `details`. When WebGL is unavailable, a static CSS illustration appears; reduced-motion preference stops idle floating and scroll-driven 3D movement.

The package section describes the current 30–100 guest offer and its four included elements, then shows the first three published package cards. The Services section shows the first three published service cards. Each section links to `/catalog`, where the matching tab loads 15 items per page as visitors scroll, with a visible Load more control as a fallback. Cards open a full-screen preview. Published package previews offer Book now, which collects a booking request and requires a customer session before submission. Service previews list current published packages that include the service; optional add-ons are shown in package previews. Empty states remain until an administrator publishes catalog entries. The planning section describes the three starting inputs and reservation fee. A request does not check availability, reserve a date, or set the final price.

## Next page handoff

Continue with package discovery and the planning flow only after confirming package pricing, add-on rules, date availability, and reservation terms in [FEATURES.md](FEATURES.md) and [ROADMAP.md](ROADMAP.md). Keep those interactions distinct from the informational landing.
