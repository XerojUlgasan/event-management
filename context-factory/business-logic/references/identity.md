# Identity and responsibilities

Clemora has three account roles: customer, staff, and admin. Registration creates a customer account. Each role has a distinct responsibility in arranging and delivering an event.

This reference describes how the roles should work. Some workflows are still planned; the [current implementation](../../../README.md#current-implementation) records what is available today.

## Admin

The admin manages the relationship with the customer and organizes the event. Here, admin means an account with the admin role and the exact title **System Administrator**.

- Communicates with customers, gathers their requirements, and discusses package choices and changes.
- Handles requests for a custom package or for services or a venue to be added to the customer's package, agreeing on the details with the customer.
- Reviews and accepts event requests and manages event scheduling. Accepting a request for processing does not itself reserve a date or confirm a booking.
- Chooses the event team from staff who have volunteered as available and appoints a coordinator from that team.
- Assigns the coordinator a checklist with timeframes and monitors progress against the event timeline.

## Staff

Staff help deliver events. They view upcoming event days and volunteer for those they are available to work. Volunteering expresses availability; the admin decides who joins the team.

A staff member cannot mark themselves available again for an event day where they already have a confirmed assignment. Job titles describe their work and do not grant extra system permissions.

## Coordinator

A coordinator is a staff member selected by the admin to coordinate a particular event's team. This is an event responsibility, not a separate account role or general admin access.

The coordinator accepts the assigned checklist and its timeframes, follows the event timeline, and checks off completed tasks. The admin monitors those updates and the event's progress.

## Customer

Customers browse packages, services, and venues. They discuss their event with the admin, including custom package requirements or services and a venue they want added to their package. They can follow the status and progress of their own event booking and conversations.

## Account boundaries

Signing in proves who a person is; their saved account role determines what they may do. An optional sign-in provider does not grant business permissions. Connecting another sign-in method preserves the same account and role; matching email addresses do not automatically combine accounts. The application provides no account role or job-title change feature.

The [product scope](../../../README.md#product-scope) governs quotation, confirmation, and other business rules beyond these responsibilities.
