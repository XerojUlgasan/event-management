# Conversation image messages

Started: 2026-11-19T11:15:22+08:00
Updated: 2026-11-19T11:39:12+08:00
Status: complete
Scope: Authorized customer/admin image messages, saved vision observations, metadata-only AI history, usable UI and local verification. No commit, push, hosted deployment, or paid provider evaluation.
Checkout: main at ebb4263; unrelated catalog thumbnail changes were already present and preserved.
Continues: none

## Goal

Let both human senders attach images and retain the originals privately. Interpret each image using `VISION_MODEL`, save observations linked to the message, and give later customer AI turns those observations without the original images.

## Result

Implemented for signed-in customers, administrators, and existing guest conversations. Images support optional captions, removable previews, full-image dialogs and stable retries. Admin images preserve human takeover. Guest image rejections do not consume the displayed allowance.

## Changes or findings

- Prisma-generated migration `20261119031756_message_images` adds private, message-owned image rows with bounded JSONB observations, ordered hashes, constraints, RLS and revoked client grants. Full replay and type generation passed in a disposable database; the additive migration was then applied locally.
- Vision and Storage preparation run outside transactions with deadlines. Message/image writes commit together. Role-scoped reads, guest expiry/claim revocation, replay conflicts and cleanup are enforced. AI history serializes observations from both senders as uncertain data, excluding original bytes and asset locations.
- Existing Button, Input, Dialog and theme styles were reused; message-specific presentation remains in the app. Image URLs preserve Node, proxy and Supabase function mounts. The local Edge environment received the selected vision model and its supervised function process was reloaded.

## Decisions

The [root README](../../README.md#booking-requests-and-messages) records limits, synchronous processing, privacy, configuration and failure behavior. Conversation images remain separate from public catalog media and knowledge.

## Verification

100 integrated API regressions passed. Final focused verification passed 48 tests: eight image/API cases, five Edge route/cap cases and 35 web message cases. API/UI types, Prisma validation, web diagnostics, production and Edge builds passed. Independent Sol source review has no unresolved findings. Guidance checks and routing scenarios cover the updated message/limit documentation.

Browser checks used real local Storage and simulated models: customer image-only send, admin caption/takeover, later observation-only AI history, private-image loading, phone layout, guest sending and visible rejection without allowance loss. Task-created objects, databases, servers and scratch files were removed. The normal Edge server advertises the new contracts.

## Remaining work

No required local implementation remains. Live-model quality and hosted rollout are unverified. Cross-worker retries can repeat vision work; cleanup is best effort. Broad workspace/design checks remain blocked by unrelated catalog issues.

## Resume here

Start with `prepare-message-images.ts`, `interpret-message-image.ts` and `chat-images.test.ts`. Preserve unrelated catalog work; provider evaluation and deployment are separate actions.
