# Event days

Event days are operational schedules for accepted booking requests. One request can have several days, each with its own date, start and end time, and timezone. Customers request dates and supply times; a System Administrator turns ready requested days into operational schedules.

This reference describes intended business behavior. The [current implementation](../../README.md#current-implementation) records what is available today; describing a workflow here does not mean it is already implemented.

## People and responsibilities

- **Customer:** Supplies requested dates and each day's start and end times, and discusses event arrangements with the admin.
- **Admin:** Reviews and accepts requests, schedules ready requested days, and creates or changes operational schedules.

Admin means a designated System Administrator, as defined in [identity and responsibilities](identity.md).

## Main workflow and handoffs

1. The admin reviews the [booking request](booking-requests.md) and accepts it for processing. Acceptance alone does not create an operational event day.
2. When requested days have customer-supplied times, the admin calls `POST /admin/event-days/schedule-requested-days` with `bookingRequestId` and `expectedUpdatedAt`. The request revision prevents scheduling from stale details.
3. Requested days without saved times remain unscheduled. The admin can schedule them after the customer supplies times.
4. The admin can create, move, or cancel operational event days as arrangements change.

## Rules and boundaries

- A requested date and its saved times are customer preferences until the admin creates the operational schedule.
- Moving a scheduled day preserves its history and creates a replacement day. Cancelling a day preserves its record as cancelled.
- Event-day scheduling does not reserve a date, establish a final price, or confirm or complete the booking.
- The [product scope](../../README.md#product-scope) governs confirmation, cancellation, event changes, and other commitments beyond this workflow.

## Event completion

The supervised worker checks submitted events once a minute and at startup. It uses the database clock and the latest end time across live scheduled days. Moved originals and cancelled days are ignored. A moved replacement contributes its current scheduled end. A booking needs at least one live day, and every requested date must link to a scheduled or explicitly cancelled day through its schedule history. Legacy requests with no requested-day list use their actual operational days. Declined and cancelled requests are ineligible.

Readiness and its alerts commit together. Each current System Administrator can receive one readiness alert per event. A schedule change clears readiness. If the event becomes ready again, the existing alert remains in history and opens the current booking details. The **Mark as finished** action requires the current booking revision and rechecks readiness under the booking lock. The successful action records the administrator and the database time and writes one in-app alert to the booking owner in the same transaction.

Finished events retain their operational and inquiry history. Schedule edits and inquiry status changes are closed once the event is finished. Package and quotation permissions still follow the inquiry status. Customers can see **Finished** on their own event details and in **My events → Finished events**, where the date reflects the administrator's confirmation.
