# Messages

Messages cover the conversation between a customer and the admin about a specific booking request. Clemora automatically creates that conversation when the customer submits the request, giving both people a place to discuss the booking and create booking-related transactions.

This reference describes intended business behavior. The [current implementation](../../../README.md#current-implementation) records what is available today; describing a workflow here does not mean it is already implemented.

## People and responsibilities

- **Customer:** Explains their event needs, asks questions, supplies requested details, and discusses their booking with the admin in its linked conversation.
- **Admin:** Handles customer communication, responds to questions, gathers missing details, and discusses the booking's arrangements with the customer.

The customer and admin use the conversation to communicate and create transactions related to that booking. As defined in [identity and responsibilities](identity.md), admin means the System Administrator.

## Main workflow and handoffs

1. The customer submits a [booking request](booking-requests.md).
2. Clemora automatically creates a conversation linked to that specific request. The customer does not need to start a separate chat for it.
3. The customer and admin exchange messages there as the admin reviews the request and follows up on the customer's needs.
4. They use that same conversation for booking-related transactions. Sent quotations are delivered there as exact-version messages with customer review controls; see [quotations](quotations.md). Other transaction types remain undefined.

## Rules and boundaries

- The conversation and its booking-related transactions belong to the specific request being discussed.
- Conversation creation happens on request submission; it does not wait for acceptance or booking confirmation.
- Submitting a request and creating its conversation do not reserve a date, establish a final price, or confirm a booking.
- Quotations are an implemented transaction type; this does not define a payment workflow. The [product scope](../../../README.md#product-scope) still governs payment exclusions and other commitments; define transaction details before implementing them.
