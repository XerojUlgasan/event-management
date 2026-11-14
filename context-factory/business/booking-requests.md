# Booking requests

Booking requests cover the handoff from a customer's chosen package and event needs to admin review and event-day planning. An event day is an operational schedule for part of the requested event; one request can have several event days.

This reference describes intended business behavior. The [current implementation](../../README.md#current-implementation) records what is available today; describing a workflow here does not mean it is already implemented.

## People and responsibilities

- **Customer:** Chooses a package, submits a booking request, supplies requested dates and times, describes the event, and provides the preferred physical event location. The customer follows their own request's status and communicates with the admin.
- **Admin:** Reviews the needs with the customer, updates the request's status, and schedules ready requested days for accepted requests.

The [identity reference](identity.md) defines these responsibilities. Admin means a designated System Administrator. The [event-days reference](event-days.md) covers operational schedules, requested-day scheduling, and schedule changes.

## Main workflow and handoffs

1. The customer submits a booking request for a specific [catalog package](catalog.md) and explains what they need.
2. The admin reviews the request, discusses missing details or changes with the customer, and updates its status as the review progresses.
3. After accepting the request for processing, the admin schedules requested days that have customer-supplied start and end times. The `POST /admin/event-days/schedule-requested-days` operation takes `bookingRequestId` and `expectedUpdatedAt`; the request revision prevents scheduling from stale details.
4. The admin can create, move, or cancel operational event days and continues customer communication in the linked conversation.

## Rules and boundaries

- Requested dates and times express the customer's preferences until the admin creates operational schedules. A schedule does not change the customer's requested details.
- The preferred location describes the physical event location; it is not selected from a location catalog.
- Submitting or accepting a request, or scheduling an event day, does not reserve a date, establish a final price, or confirm a booking.
- The [product scope](../../README.md#product-scope) governs quotation, confirmation, cancellation, and other decisions beyond this workflow. Do not infer missing business rules from request acceptance or scheduling.
