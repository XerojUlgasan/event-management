# Package-owned add-ons and direct quotation sending

Date: 2026-11-21
Status: add-on ownership superseded by [Booking-owned add-ons](2026-11-22_booking-owned-add-ons.md). Send or Cancel remains accepted.
Authority: The user approved mandatory package add-ons, shared package Edit and Remove actions with confirmation, and Send or Cancel.
Implementation: see the [direct quotation send run](../../runs/2026-11-21_00-49-10_direct-quotation-send.md).

## Decision

Prepare every quotation from the current proposal. The package add-on list controls service membership and pricing. Add new services in the private package. Shared Edit and Remove controls in the quotation update the private package after confirmation. Quote preparation temporarily holds add-on hours, manual fees and discounts, and the revision reason.

Send commits the complete offer and linked message together. Cancel discards preparation and retains any separately confirmed package updates. Supersede the prior offer only when its replacement is sent. Retain legacy unsent records outside the active workflow.

This replaces the [earlier quotation add-on decision](2026-11-21_quotation-package-addons.md). The [quotation rules](../../business/quotations.md) describe the current workflow.
