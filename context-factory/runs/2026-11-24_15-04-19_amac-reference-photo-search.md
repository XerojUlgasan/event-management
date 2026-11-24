# AMAC reference-photo search

Started: 2026-11-24T14:54:09+08:00
Updated: 2026-11-24T15:10:36+08:00
Status: complete
Scope: Implement and verify the existing chat catalog tool in the assigned worktree. Integration, push, and deployment require separate authorization.
Checkout: `feat/catalog-search-chat-photo` from `d97cd163`.
Continues: [AMAC catalog browse attachments](2026-11-24_00-32-33_amac-catalog-browse.md)

## Result

Guests and signed-in customers can request visual catalog matches from saved chat photos. AMAC calls the existing search once per selected photo and may include a requested visual focus. The server validates the authorized original and submits it to Gemini. Photo pages rank fresh public photo chunks, group matches by listing, and carry the exact filter and attachment scope. The reply uses attributed links for separate photos. The latest delivered page for each photo and catalog type can be continued from the same chat. See the [tool contract](../../README.md#current-implementation) and [message behavior](../business/messages.md).

## Verification

The isolated website uses `http://127.0.0.25:4751`, Edge and private Storage on 57421, PostgreSQL on 57422, and a Node background worker from the assigned checkout. Browser and real Gateway runs verified four attachments in order, four linked visual searches, and labeled replies. A guest follow-up used only photo two's cursor and returned a disjoint page. The live model truncated a signed-in reply after three successful searches at the ordinary 800-token step limit. With a 1,600-token step limit after distinct photo searches and the existing 3,200-token turn budget, new signed-in three-photo and guest four-photo runs saved replies on their first attempts. A deleted test original produced a sanitized unavailable-photo audit and a saved reply based on a separate text search. Direct Gemini checks showed that changing either the pixels or the supplied focus changed the 768-dimensional vector. Four crops of seeded catalog photos ranked their source listings first in a 16-photo sample. Some demo listings share images, and this sample does not establish relevance for independent customer photos.

The focused API suites passed 187 with six opt-in skips. Catalog knowledge passed 57 tests. API types and the Edge build passed. The wider messages suite has an existing migration-fixture failure on `booking_requests.submitted_at`. The guidance tests passed and the link check reported two existing links to renamed proposal tools.

## Resume here

Review the worktree commit and await explicit merge instruction. The local integration checkout on `main` was observed clean at `d97cd163`. Use the assigned preview URL, open **Chat with us**, attach up to four non-sensitive photos, and ask for separate package matches.
