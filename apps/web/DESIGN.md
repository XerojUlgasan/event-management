---
name: Styled by AMAC
description: Event management with a quiet, editorial visual identity.
colors:
  charcoal: "#3a3937"
  paper: "#f4f4f4"
  taupe: "#a89c95"
  taupe-text: "#71645a"
  surface: "#ffffff"
  border: "#d7d1cd"
typography:
  display:
    fontFamily: "Playfair Display, serif"
    fontSize: "clamp(50px, 6.1vw, 88px)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  caption:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0.02em"
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  control:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  support:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  heroSupport:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "clamp(15px, 1.3vw, 17px)"
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: "normal"
  aboutBody:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: "normal"
  tabletDisplay:
    fontFamily: "Playfair Display, serif"
    fontSize: "clamp(48px, 9vw, 72px)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  mobileDisplay:
    fontFamily: "Playfair Display, serif"
    fontSize: "clamp(44px, 11vw, 64px)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  mobileSection:
    fontFamily: "Playfair Display, serif"
    fontSize: "clamp(32px, 8vw, 42px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.03em"
rounded:
  control: "8px"
  button: "9px"
  panel: "10px"
  dialog: "16px"
spacing:
  control: "12px"
  section: "clamp(64px, 7vw, 100px)"
components:
  button-primary:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "0 18px"
    height: "43px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
---

# Design System: Styled by AMAC

## Overview

**Creative North Star: "A calm, editorial welcome"**

The approved identity uses the actual supplied AMAC logo with a charcoal, off-white, and taupe palette. Public pages use spacious serif-led composition and a restrained catalog presentation. The same brand theme carries through login and administrator, customer, and staff workspaces, where information density follows the task.

Shared controls and theme values are owned by `packages/ui` and `packages/theme`. App-specific public composition lives in `apps/web/src/styles/public/site.css`. The shared Brand and Wordmark render the supplied transparent logo at its original proportions. The favicon frames the first A from the original artwork for recognition at browser-tab sizes.

**Key Characteristics:**
- Quiet, spacious public presentation with serif display headings.
- Sans-serif text and controls for reading and operational tasks.
- Charcoal, paper, and taupe identity with distinct readable taupe text.
- Operational status colors and information density remain clear in workspaces. Calendar count intensity uses a neutral paper-to-taupe-to-charcoal scale.

## Colors

The brand palette pairs warm-neutral surfaces with charcoal text and muted taupe accents. Exact values are normative in the frontmatter and implemented in `packages/theme/src/theme.css`.

### Primary
- **Charcoal:** Primary text, dark panels, and primary actions.

### Secondary
- **Decorative Taupe:** Muted decorative accents and secondary brand details.
- **Readable Taupe:** Secondary text, focus outlines, and accent text where contrast matters.

### Neutral
- **Paper:** Main branded page background.
- **White Surface:** Shared control and raised surface background.
- **Soft Border:** Dividers and control outlines.

### Named Rules
**The Readable Taupe Rule.** Use the darker readable taupe for text and focus indicators; reserve the lighter taupe for decoration.

**The Status Clarity Rule.** Keep success, warning, danger, and information colors distinct in operational workflows rather than recoloring statuses to match the brand palette.

## Typography

**Display Font:** Playfair Display (with generic serif fallback)
**Body Font:** DM Sans (with sans-serif fallback)

Both font files are served locally from `apps/web/public/fonts/`. Playfair Display gives public headlines an editorial character; DM Sans supports catalog details, forms, navigation, and dense workspace information.

### Hierarchy
- **Display** (500, `clamp(50px, 6.1vw, 88px)`, 1.08 line-height): public split-hero heading. Catalog card headings use weight 600 and the serif family.
- **Body** (400, 16px, 1.5 line-height): standard product copy and controls; individual components may set task-specific sizing.
- **Header and control** (14px, DM Sans): navigation, links, and shared actions; buttons retain their shared 600 weight.
- **Support** (14px, 1.7 line-height): login introduction and visual-panel supporting copy.
- **Hero support** (`clamp(15px, 1.3vw, 17px)`, 1.8 line-height, up to 44ch): explanatory text beside the public headline.
- **About body** (17px, 1.8 line-height, up to 65ch): longer public about-page copy.
- **Label** (13px): login field labels and account helper text.
- **Caption** (12px): image captions and compact authentication notes.
- **Tablet display** (`clamp(48px, 9vw, 72px)`): hero display at widths up to 820px.
- **Mobile display** (`clamp(44px, 11vw, 64px)`): hero display at widths up to 600px.
- **Mobile section** (`clamp(32px, 8vw, 42px)`): public section headings at widths up to 600px.

## Layout

The public landing hero uses a centered container up to 1440px, with a two-column text-and-image composition and responsive spacing. Catalog and editorial sections use generous vertical padding. Public catalog entries use the same rounded cards as the signed-in catalog in a responsive grid. At narrower widths, the navigation switches to a mobile menu and page composition adapts in `apps/web/src/styles/public/site.css`.

Login uses an image-and-quote split beside the form on desktop. At widths up to 600px, the visual panel hides and the form gains a logo, prioritizing the brand and sign-in flow. Operational workspaces retain layouts suited to administration, customer tasks, and staff coordination. The admin sidebar and header share the paper surface, with charcoal text and soft taupe selection and hover states. Their shared brand tokens and controls come from the theme and UI packages; operational density and status cues remain task-led.

## Elevation & Depth

Catalog cards sit flat at rest and lift with a soft shadow on hover. Shared application surfaces use the theme's subtle elevation where it supports controls, dialogs, and workspace hierarchy.

## Shapes

Public content favors open space, simple rectangular imagery, fine dividers, and square-edged callout panels. Catalog cards use the same rounded corners across public and workspace views. Shared controls retain their established rounded control and button corners, with larger rounding for panels and dialogs.

## Components

### Brand
- The shared `Brand` and `Wordmark` components scale the supplied transparent logo proportionally. Keep the source image intact.

### Buttons
- Shared buttons use charcoal for primary actions, white surfaces for secondary actions, and existing link, light, and ghost variants where appropriate. They retain visible keyboard focus and disabled states from `packages/ui/src/styles.css`.

### Fields
- Shared fields use a white surface, subtle border, and rounded control shape. Focus, invalid, disabled, and read-only states remain visibly distinct.

### Public navigation
- Public navigation uses a compact header and a readable taupe focus outline. At the 1100px breakpoint it switches to the mobile menu.

### Public catalog
- Public and signed-in catalog entries share the card layout, thumbnail treatment, and pricing summary. Public cards link to the full detail page. Signed-in catalog actions open an in-place preview.

### Status badges
- Workspace badges preserve distinct success, warning, danger, information, and neutral meanings through the shared UI styles.

### Conversation controls
- Customer and admin Messages share the same icon-only buttons for booking details, package, and quotation. Each button has an accessible name. The admin AI switch uses a pill-shaped track with a thumb that shows the current position. Customer and admin composers share one row for the camera, message field, and send button. Image drafts and validation messages appear below it.

## Do's and Don'ts

- **Do** use the shared theme tokens and UI components for new branded surfaces.
- **Do** use Playfair Display for editorial display headings and DM Sans for body and operational text.
- **Do** use readable taupe for text and reserve decorative taupe for non-text accents.
- **Do** preserve the operational status palette and clarity of dense workspace tasks.
- **Do** preserve the original artwork and proportions when sizing the supplied logo.
- **Don't** apply the spacious public-page density to information-heavy admin, customer, or staff workflows.
- **Don't** treat brand or visual choices as changes to product policy or scope.
