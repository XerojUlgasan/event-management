# Quotations

A quotation is the admin's price offer for a customer's booking inquiry. It sets out the package price, add-on charges, manual fees or discounts, and the total for the customer to review. The [product reference](product.md#private-packages-and-quotations) records the current implementation.

## People and responsibilities

- **Admin:** Discusses requirements, prepares the package and quotation, sends offers, and handles revisions. Any System Administrator can do this work, with their actions recorded.
- **Customer:** Views their own proposal and sent quotations. The customer uses chat to agree, raise concerns, or request a revised offer.

## Main workflow and handoffs

1. The customer submits a [booking request](booking-requests.md), with or without an initial package. The linked [conversation](messages.md) is where the customer and admin discuss requirements.
2. The admin chooses a catalog package or prepares a private custom package for the request. An available proposal and an open request are required to prepare the quotation.
3. The quotation editor uses the current proposal price and the booking's offered add-ons. Admins manage add-on offers on the booking request; these changes leave the service catalog intact.
4. The admin completes add-on hours and reviews the total. Use **Cancel** to discard unsent quotation changes or **Send** to record the completed version and publish its exact-version message together. Confirmed booking updates have their own save and persist after quotation cancellation.
5. If a customer asks for changes through chat, the admin prepares a revision with a reason. The editor starts from the current package and booking add-ons. The previous offer remains active until its replacement successfully sends, then stays readable in history with its amounts, message, and revision links.

## Rules and boundaries

- Included service widgets are covered by the package base price. Extensions may be recorded as manual adjustments. Calculate a fixed-price add-on as base price plus whole extra hours times the excess rate. An hourly-only add-on needs a positive whole number of booked hours. Manual fees and discounts carry no catalog service selection.
- The server validates all current add-ons and calculates the total. Send requires complete pricing, a nonnegative total, current booking and proposal data, and the linked conversation. Resolve an unavailable add-on on the booking before sending. Refresh and review if the package or current offer has changed. Repeating the same send request should produce one offer and one message.
- Sent and superseded versions retain their financial history as packages and services change. A revision creates a new version. Legacy unsent records are retained without a draft workflow.
- Declined and cancelled requests are read-only. Quotations have no automatic expiry. A signed-in booking conversation remains available for delivery.
- Quotations and chat replies do not confirm a booking, reserve dates, create event schedules, or establish a payment workflow. The [product scope](product.md#product-scope) governs these commitments.
