# Event days and staffing

Event days and staffing cover the scheduled days of work for an accepted booking request, staff availability, and the admin's selection of each day's team. One request can have several event days, each with its own schedule, response deadline, and team.

This reference follows the intended responsibilities in [identity and responsibilities](identity.md) and explains the current scheduling and staffing workflow. Current rules below describe today's behavior, not approval of unresolved business policies. The [current implementation](../../README.md#current-implementation) records full implementation status; coordinator checklists and progress tracking are implemented through the API.

## People and responsibilities

- **Customer:** Supplies requested dates and each day's start and end times, and discusses event arrangements with the admin.
- **Admin:** Arranges event days, opens and closes availability responses, selects staff, appoints the coordinator, and manages schedule changes. The admin remains responsible for customer communication and monitoring event progress.
- **Staff:** Review upcoming event days, respond available or unavailable, and work on the days for which the admin confirms their assignment.
- **Coordinator:** A selected staff member responsible for coordinating the team. The admin sends a timed checklist for immediate access. The coordinator edits tasks, follows the timeline, and records progress without an acceptance step.

Admin means the System Administrator. Coordinator is an event responsibility, not a separate account role or general admin access.

## Main workflow and handoffs

The current scheduling and staffing workflow is:

1. The admin accepts the [booking request](booking-requests.md) for processing. Requested dates remain customer preferences until the admin arranges operational event days; acceptance and saving times alone create no event day.
2. Once the customer has supplied a requested day's times, the admin applies response deadlines to create and open the ready event days. Dates still waiting for times remain unscheduled; the admin applies deadlines again when those details arrive.
3. Staff review each day's schedule and respond before its deadline. Responding available volunteers for that day; it does not place the person on the team.
4. After responses close, the admin selects available staff as helpers and appoints a coordinator from that day's selected staff. Confirmed assignments identify the team.

The admin creates one private checklist draft per event day, then sends it to that day's current confirmed coordinator. Sending grants access immediately; there is no acceptance control, endpoint, or state. The coordinator can edit titles, instructions, each task’s date/time, status and notes, reorder tasks, and add/delete tasks. Tasks are stored as an ordered JSONB array inside a content object, with stable server-generated IDs. Completion keeps server-owned `completedAt`; there is no task completion actor field. Blocked tasks require a concern note. The admin monitors the same document.

Every save and send checks a revision to reject stale changes. Both reads and writes check the saved recipient and current confirmed assignment. Any coordinator assignment cancellation, demotion, replacement or renewal invalidates the handoff atomically and returns the saved tasks to an admin-only draft. Reassigning the same person does not restore old access; a fresh admin send is required. Cancelling/moving the day or cancelling its request also revokes access in the same transaction. Each task owns its schedule, which may precede/follow the event day; there are no task groups. Sending requires at least one task, while the coordinator may delete the last task afterward. This handoff creates in-app access, not email or push delivery. See [coordinator checklists](../../README.md#coordinator-checklists) for the persisted boundary.

## Current rules and boundaries

- Each day has its own staffing decisions. Schedules and response deadlines use the booking's timezone; an event may finish the following day.
- The admin chooses a response deadline one, two, three, or four calendar days before the event date, ending at the close of that local date. Applying the choice across a request uses each day's date. Closed response windows stay closed; reopening is a separate admin decision and requires a future deadline.
- Staff can respond only while availability is open and before the deadline. No response is distinct from unavailable. A staff member already confirmed on that day cannot mark themselves available again; responding unavailable does not cancel an existing assignment.
- The admin confirms only staff who responded available, after responses close. A day allows at most one confirmed coordinator. Confirmed work times for the same staff member must not overlap, including overnight work.
- Cancelling an event day closes responses and cancels its assignments. Cancelling the request does the same for all its scheduled days. Moving a day retains the original history and creates a replacement with no responses or assignments; staff must respond and be selected again.
- Scheduling, staff availability, and confirmed staff assignments do not reserve a date, establish a final price, or confirm the customer's booking.

The [product scope](../../README.md#product-scope) governs intended commitments and unresolved availability, confirmation, cancellation, event-change, notification, and other workforce policies. Establish those decisions before extending the workflow; current behavior does not settle them.
