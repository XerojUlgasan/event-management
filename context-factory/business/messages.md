# Messages

Messages include general inquiries and conversations about a specific booking request. Clemora automatically creates a linked conversation when a customer submits a request, giving both people a place to discuss the booking and create booking-related transactions. A public visitor can start a separate anonymous, bookingless inquiry through Chat with us.

This reference describes intended business behavior. The [current implementation](../../README.md#current-implementation) records what is available today; describing a workflow here does not mean it is already implemented.

## People and responsibilities

- **Customer:** Explains their event needs, asks questions, supplies requested details, and discusses their booking with the admin in its linked conversation.
- **Admin:** Handles customer communication, responds to questions, gathers missing details, and discusses the booking's arrangements with the customer.

The customer and admin use the conversation to communicate and create transactions related to that booking. As defined in [identity and responsibilities](identity.md), admin means the System Administrator.

## Main workflow and handoffs

1. The customer submits a [booking request](booking-requests.md).
2. Clemora automatically creates a conversation linked to that specific request. The customer does not need to start a separate chat for it.
3. The customer and admin exchange messages there as the admin reviews the request and follows up on the customer's needs.
4. They use that same conversation for booking-related transactions. Sent quotations are delivered there as exact-version messages that customers can open and view. Customers respond or request a new quotation through chat; only the admin changes quotations. See [quotations](quotations.md). Other transaction types remain undefined.

## Rules and boundaries

- The conversation and its booking-related transactions belong to the specific request being discussed.
- Conversation creation happens on request submission; it does not wait for acceptance or booking confirmation.
- Signed-in general and booking-linked conversations do not expire automatically, including after the event ends. Anonymous conversations follow the inactivity policy below.
- Existing closed conversations retain their status and history. This policy change does not reopen old booking threads because their closure reason was not recorded.
- Submitting a request and creating its conversation do not reserve a date, establish a final price, or confirm a booking.
- Quotations are an implemented transaction type; this does not define a payment workflow. The [product scope](../../README.md#product-scope) still governs payment exclusions and other commitments; define transaction details before implementing them.

## Anonymous inquiries and account claim

- A guest browser identity owns one unexpired anonymous conversation at a time. Opening chat again reuses it. A cookie proves possession of that browser identity; it does not identify a physical device or an account.
- An anonymous conversation expires after 24 hours without customer, admin, or assistant messages. Reading, polling, and changing the AI preference do not extend that time. An empty thread starts its inactivity window at creation. Once expired, the guest can start a new conversation with a fresh allowance.
- Each anonymous conversation allows five successfully saved customer messages. Admin and assistant messages do not use that allowance. The fifth customer message can receive its normal reply; further customer sends require login. The history remains readable until expiry. A saved message still counts if its automatic reply fails, and retrying an uncertain send must not save it twice.
- Sign in to continue claims the selected thread using both the customer session and the guest cookie. The server attaches the same conversation and saved history to that customer, revokes guest access to it, and removes its anonymous deadline. Claiming does not create a booking request or combine other conversations. Repeating the claim for that customer is safe; another account cannot take ownership.
- Login and claim are separate outcomes. A failed claim keeps the customer signed in and offers a retry. Signing out does not restore anonymous access to a claimed thread. Administrators handle guest messages through their inbox and cannot claim a guest thread as a customer.

## AI and human handling

- AI replies are enabled by default per conversation. Only a System Administrator can change the toggle.
- A successfully sent admin message or quotation switches that conversation to human handling. AI stays off until an admin explicitly re-enables it; failed sends do not change the preference.
- Customers can continue messaging while AI is off. Re-enabling AI applies to future customer messages, without generating replies to the backlog.
- Takeover suppresses any unfinished AI reply. Conversation history stays intact, and closing or reopening a conversation does not reset its AI preference. Closed conversations cannot be toggled.
