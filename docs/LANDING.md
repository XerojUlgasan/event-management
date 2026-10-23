# Landing page implementation

The public `/` route implements the approved minimal Clemora direction: pale lilac-gray canvas, ink typography, restrained coral accents, generous space, and one interactive event still life. Other product pages remain for later work.

## Structure

- `apps/web/src/pages/index.astro` contains the landing content and local navigation anchors.
- `apps/web/src/styles/landing.css` contains page layout and responsive behavior.
- `apps/web/src/components/LandingScene.tsx` mounts a client-only React Three Fiber canvas, detects WebGL support, and handles pointer drag, scroll progress, and reduced motion.
- `apps/web/src/components/scene/EventModels.tsx` draws the chair, table, flowers, and photo booth with local Three.js geometry. No remote model or image service is required.
- `packages/theme/src/theme.css` holds the new visual tokens. `packages/ui/src` holds the reusable wordmark, action link, section counter, site header, and inclusion strip.

## Behavior

Drag the 3D composition horizontally to rotate it. Scrolling through the sticky opening section changes the object's arrangement and reveals the second line of copy. The navigation scrolls to sections on the landing page. The mobile navigation uses native `details`. When WebGL is unavailable, a static CSS illustration appears; reduced-motion preference stops idle floating and scroll-driven 3D movement.

The package section describes the current 30–100 guest offer and its four included services. The planning section describes the three starting inputs and reservation fee. It does not collect inquiries, quote prices, check availability, reserve dates, or take payments.

## Next page handoff

Continue with package discovery and the planning flow only after confirming package pricing, add-on rules, date availability, and reservation terms in [FEATURES.md](FEATURES.md) and [ROADMAP.md](ROADMAP.md). Keep those interactions distinct from the informational landing.
