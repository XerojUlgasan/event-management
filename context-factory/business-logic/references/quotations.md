# Quotations

A quotation is the admin's price offer for a customer's booking inquiry. It sets out the package price, any additions or deductions, and the total for the customer to review. This domain covers preparing private proposals, sending offers, customer feedback through chat, admin revisions, and quotation history.

This reference describes intended business behavior. The [current implementation](../../../README.md#private-packages-and-quotations) records what is available today; describing a workflow here does not mean it is already implemented.

## People and responsibilities

- **Admin:** Discusses requirements with the customer, prepares the package proposal and quotation, reviews adjustments, sends offers, and handles revisions. As defined in [identity and responsibilities](identity.md), admin means the System Administrator. Any System Administrator may continue this work, with their actions recorded.
- **Customer:** Explains their requirements, views their own proposal and sent quotations, and uses chat to say whether they agree with an offer, raise concerns, or request a new quotation. Customers do not edit quotations or see internal drafts.

## Main workflow and handoffs

1. The customer submits a [booking request](booking-requests.md). Its linked [conversation](messages.md) gives the customer and admin a place to discuss requirements.
2. The admin prepares the proposal using the selected catalog package or a private custom package for that booking. A private package can be tailored without changing the public catalog.
3. The admin creates a quotation draft from the current proposal price and enters any manual additions or deductions. Clemora calculates the total; a package-only offer is also valid.
4. The admin saves and sends the offer. The customer can review that exact version from the booking details or its message in the linked conversation.
5. The customer responds through chat. A reply records the conversation without changing quotation status or creating a draft. When a new offer is needed, the admin starts a revision with a reason. Starting it immediately marks the previous offer as superseded; it remains in history.
6. The new draft uses the current proposal price and carries over the previous adjustments. The admin reviews those adjustments, saves, and sends the new version. The draft stays internal until sent, and the customer continues the discussion through chat.

## Rules and boundaries

- Only System Administrators create, revise, save, or send quotations. Customers view offers and communicate through chat. Quotations and chat replies do not confirm the booking, reserve dates, create event schedules, or establish a payment workflow.
- Existing accepted quotations, acceptance timestamps, and audit records remain as history. They stay readable and can be revised by an admin; the customer acceptance and revision actions have been removed.
- The original inquiry's package choice stays recorded separately from the current proposal. A quotation preserves its offered price and adjustments; package descriptions, services, and event details remain part of the current proposal and booking.
- Later package or event edits do not change saved quotation amounts. The admin must discuss changes affecting the agreed price or delivery and explicitly revise the offer when a new quotation is needed.
- Adding a service to a package does not automatically price it or establish availability. Quotation adjustments are entered and reviewed by the admin; an offer cannot be sent with a negative total.
- Drafts can be edited. Sent offers retain their financial history, and changes require a new version rather than rewriting the old offer.
- Quotations have no automatic expiry. Sending requires an active linked conversation and does not reopen a closed one. Conversation age, inactivity, and the parent event end time do not block delivery. Declined or cancelled requests cannot receive quotation edits or new offers. Existing closed booking conversations remain read-only; the customer can start a new chat to contact the team.
- Requested dates, operational schedules, and staffing remain separate from quotation discussions. Team assignments, response deadlines, and linking an unchanged schedule do not themselves require a new quotation. The [product scope](../../../README.md#product-scope) governs confirmation and other commitments.
