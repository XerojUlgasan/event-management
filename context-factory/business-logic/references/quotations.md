# Quotations

A quotation is the admin's price offer for a customer's booking inquiry. It sets out the package price, any additions or deductions, and the total for the customer to review. This domain covers preparing private proposals, sending offers, customer acceptance, revisions, and quotation history.

This reference describes intended business behavior. The [current implementation](../../../README.md#private-packages-and-quotations) records what is available today; describing a workflow here does not mean it is already implemented.

## People and responsibilities

- **Admin:** Discusses requirements with the customer, prepares the package proposal and quotation, reviews adjustments, sends offers, and handles revisions. As defined in [identity and responsibilities](identity.md), admin means the System Administrator. Any System Administrator may continue this work, with their actions recorded.
- **Customer:** Explains their requirements, reviews their own proposal and sent quotations, and accepts an offer or requests a revision with a reason. Customers do not edit quotation prices or see internal drafts.

## Main workflow and handoffs

1. The customer submits a [booking request](booking-requests.md). Its linked [conversation](messages.md) gives the customer and admin a place to discuss requirements.
2. The admin prepares the proposal using the selected catalog package or a private custom package for that booking. A private package can be tailored without changing the public catalog.
3. The admin creates a quotation draft from the current proposal price and enters any manual additions or deductions. Clemora calculates the total; a package-only offer is also valid.
4. The admin saves and sends the offer. The customer can review that exact version from the booking details or its message in the linked conversation.
5. The customer accepts the sent offer or requests a revision. Either the customer or admin can start a revision, including after acceptance. Starting it immediately marks the previous offer as superseded: it remains in history but is no longer the active agreement.
6. The new draft uses the current proposal price and carries over the previous adjustments. The admin reviews those adjustments before sending the new version, which requires fresh customer acceptance. A customer requesting revision receives an acknowledgment; the new draft stays internal until sent.

## Rules and boundaries

- Accepting a quotation approves that price offer. It does not confirm the booking, reserve dates, create event schedules, or establish a payment workflow.
- The original inquiry's package choice stays recorded separately from the current proposal. A quotation preserves its offered price and adjustments; package descriptions, services, and event details remain part of the current proposal and booking.
- Later package or event edits do not change saved quotation amounts or automatically invalidate acceptance. The admin must discuss changes affecting the agreed price or delivery and explicitly revise the offer when a new agreement is needed.
- Adding a service to a package does not automatically price it or establish availability. Quotation adjustments are entered and reviewed by the admin; an offer cannot be sent with a negative total.
- Drafts can be edited. Sent offers retain their financial history, and changes require a new version rather than rewriting the old offer.
- Quotations have no automatic expiry. Sending requires an open, unexpired linked conversation and does not reopen a closed one. Declined or cancelled requests cannot receive quotation edits, new offers, or acceptance.
- Requested dates, operational schedules, and staffing remain separate from quotation approval. Team assignments, response deadlines, and linking an unchanged schedule do not themselves require a new price agreement. The [product scope](../../../README.md#product-scope) governs confirmation and other commitments.
