# Quotation charges from private package add-ons

Date: 2026-11-21
Status: superseded by [Package-owned add-ons and direct quotation sending](2026-11-21_direct-quotation-send.md)
Authority: The user chose automatic add-on charges, quotation-level overrides, explicit removal, and hours entered by the admin. The user also approved compact rows with edit dialogs.
Implementation: see the [quotation add-ons run](../../runs/2026-11-21_00-00-00_quotation-package-addons.md).

## Decision

The first quotation draft copies the private package's add-ons. Quotation-specific overrides replace the copied prices or rates. Add whole extra hours to fixed-price coverage or enter whole service hours for an hourly-only charge. Save the resulting charge and its terms with the quotation.

An admin can remove a charge and save the draft. Reopening or revising carries the saved selection forward. A revision adopts the current package base price and requires review. Remove a carried charge if the service is now included in that price. Remove an add-on archived before it was copied into the draft. Subsequent archive and catalog edits leave copied terms intact.

## Rationale

Copying charges removes duplicate selection work for an admin who has already prepared a private package. Saving the terms on each charge preserves the agreed amounts through catalog edits and preserves every sent version in the conversation.

## Consequences

An unpriced hourly add-on remains editable in the draft and blocks sending. The first draft is the only automatic import. For later additions or extensions of included services, use an explicit manual adjustment. The [quotation rules](../../business/quotations.md) govern editing and delivery. The [package service terms decision](2026-11-20_package-service-terms.md) governs the source terms.
