# Booking requests

Booking requests cover the handoff from a customer's event needs to admin review and event-day planning. A customer may select a catalog package or ask the admin to prepare a custom package later. An event day is an operational schedule for part of the requested event; one request can have several event days.

This reference describes intended business behavior. The [current implementation](../../README.md#current-implementation) records what is available today; describing a workflow here does not mean it is already implemented.

## People and responsibilities

- **Customer:** Submits a booking request with an optional package, supplies requested dates and times, describes the event, and provides the preferred physical event location. The customer follows their own request's status and communicates with the admin.
- **Admin:** Reviews the needs with the customer, updates the request's status, and schedules ready requested days for accepted requests.

The [identity reference](identity.md) defines these responsibilities. Admin means a designated System Administrator. The [event-days reference](event-days.md) covers operational schedules, requested-day scheduling, and schedule changes.

## Main workflow and handoffs

1. The customer submits a booking request and explains what they need, either selecting a [catalog package](catalog.md) or choosing to discuss a custom package. Submission from an existing general conversation binds the request to that same conversation.
2. The admin reviews the request, discusses missing details or changes with the customer, and updates its status as the review progresses.
3. After accepting the request for processing, the admin schedules requested days that have customer-supplied start and end times. The `POST /admin/event-days/schedule-requested-days` operation takes `bookingRequestId` and `expectedUpdatedAt`; the request revision prevents scheduling from stale details.
4. The admin can create, move, or cancel operational event days and continues customer communication in the linked conversation.

## Rules and boundaries

- A request may have no initial catalog `package_id`. In that state, its package and price are not yet known; views show "Package to be prepared" and "To be discussed" rather than inventing a zero price.
- Only a System Administrator assigns an available catalog package to a request without a package, or prepares a booking-owned private package from scratch. Existing catalog choices and private proposals retain their history. A private proposal may also start as a copy of a catalog package.
- Admin package preparation, catalog assignment, and quotation work are eligible while a request is `under_review`, `needs_details`, or `accepted`; accepting it first is unnecessary. Declined and cancelled requests retain readable packages and quotation history but cannot receive those changes. Package, revision, and conversation prerequisites still apply; see [quotations](quotations.md).
- A selected catalog package's current name, price, and maximum guests come from that record. Private proposals and saved quotation amounts have separate owners. A prepared catalog or private package is required before creating a quotation.
- Requested dates and times express the customer's preferences until the admin creates operational schedules. A schedule does not change the customer's requested details.
- The preferred location describes the physical event location; it is not selected from a location catalog.
- Submitting or accepting a request, or scheduling an event day, does not reserve a date, establish a final price, or confirm a booking.
- The [product scope](../../README.md#product-scope) governs quotation, confirmation, cancellation, and other decisions beyond this workflow. Do not infer missing business rules from request acceptance or scheduling.
