# Booking requests

Booking requests cover the handoff from a customer's chosen package and event needs to admin review, event-day planning, and staff selection. An event day is a scheduled day of work for the requested event; one request can have several event days.

This reference describes intended business behavior. The [current implementation](../../../README.md#current-implementation) records what is available today; describing a workflow here does not mean it is already implemented.

## People and responsibilities

- **Customer:** Chooses a package, submits a booking request, explains their event needs, and supplies missing details. The customer follows their own request's status and communicates with the admin.
- **Admin:** Reviews the needs with the customer, updates the request's status, arranges event days for accepted requests, and decides when to open each day for staff availability. The admin selects the team and its coordinator, assigns the coordinator a timed checklist, and monitors progress.
- **Staff:** Review event days open for availability responses and mark themselves available for days they can work. The admin decides which volunteers join each day's team.
- **Coordinator:** A selected staff member who coordinates the team, accepts the assigned checklist and timeframes, and records completed tasks for the admin to monitor.

The [identity reference](identity.md) defines these responsibilities. Admin means the System Administrator; coordinator is an event responsibility, not a separate account role or general admin access. The [event days and staffing reference](event-days-and-staffing.md) covers daily schedules, response deadlines, team assignments, and schedule changes.

## Main workflow and handoffs

1. The customer submits a booking request for a specific [catalog package](catalog.md) and explains what they need.
2. The admin reviews the request, discusses missing details or changes with the customer, and updates its status as the review progresses.
3. Once the request is accepted for processing, the admin arranges its event days and decides when each day is ready to open for staff availability responses. Acceptance alone does not create or open an event day.
4. Staff mark themselves available for the open days they can work.
5. The admin reviews availability, selects the staff included in each day's team, and appoints a coordinator from the selected staff.
6. The admin hands the coordinator a checklist with timeframes. The coordinator tracks completion against the event timeline, and the admin monitors progress.

## Rules and boundaries

- Requested dates express the customer's preferences. Staff availability and team selection apply to the event days arranged by the admin.
- Marking available is volunteering, not an assignment. A staff member already confirmed on an event day cannot mark themselves available again for that same day.
- Submitting or accepting a request, opening staff availability, or selecting a team does not reserve a date, establish a final price, or confirm a booking.
- The [product scope](../../../README.md#product-scope) governs quotation, confirmation, cancellation, and other decisions beyond this workflow. Do not infer missing business rules from request acceptance or staffing decisions.
