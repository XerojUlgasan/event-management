# Business logic

Load the reference for the domain affected by the task before making business decisions. These references explain intended behavior; the [root README](../../README.md#current-implementation) records implementation status, and current source establishes what the application does.

| Domain | Load when the task involves | Reference |
| --- | --- | --- |
| Identity | Customer and admin accounts, account access, customer communication, scheduling, and event progress | [Identity and responsibilities](identity.md) |
| Catalog | Package and service listings, customer browsing and package booking requests, or admin preparation of custom packages | [Catalog](catalog.md) |
| Booking requests | Customer package requests, admin review and status updates, requested event days and times, or admin event scheduling | [Booking requests](booking-requests.md) |
| Event days | Operational event-day schedules, requested-day scheduling, movement, or cancellation | [Event days](event-days.md) |
| Messages | Automatic conversations after booking-request submission, customer/admin communication about a specific booking, or booking-related transactions within that conversation | [Messages](messages.md) |
| Quotations | Private package proposals, quotation prices and adjustments, draft preparation, conversation delivery, customer feedback through chat, admin revisions, or quotation history | [Quotations](quotations.md) |

For work crossing domains, load each relevant reference. When a domain or decision is missing, state the gap and use the user's direction and [product scope](../../README.md#product-scope); ask about unresolved rules that affect permissions or commitments.

Pair business context with the owning area skill from [repository guidance](../../AGENTS.md). For sign-in, account linking, sessions, and enforced permissions, also read the [API authentication reference](../areas/api/references/auth-and-sessions.md). Keep intended responsibilities separate from current permissions and implemented workflows in the result.
