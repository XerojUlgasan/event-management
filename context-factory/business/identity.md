# Identity and responsibilities

AMAC has two account roles: customer and admin. Registration creates a customer account. Admin accounts are reserved for designated System Administrators.

This reference describes how the roles should work. Some workflows are still planned; the [current implementation](product.md#current-implementation) records what is available today.

## Admin

The admin manages the relationship with the customer and organizes the event. A System Administrator is an account with the saved `admin` role.

- Communicates with customers, gathers their requirements, and discusses package choices and changes.
- Handles requests for a custom package or service to be added to the customer's package, agreeing on the details and physical event location with the customer.
- Reviews booking requests, updates their status, and manages event scheduling. Accepting a request for processing does not itself reserve a date or confirm a booking.

## Customer

Customers browse packages and services. They discuss their event with the admin, including custom package requirements, service additions, and the physical event location. They can follow the status and progress of their own booking request and conversations.

## Account boundaries

Signing in proves who a person is; the saved account role determines what they may do. An optional sign-in provider does not grant business permissions. Connecting another sign-in method preserves the same account and role; matching email addresses do not automatically combine accounts. Public registration creates customers; only designated System Administrators have admin access. The application provides no customer role-change feature.

The [product scope](product.md#product-scope) governs quotation, confirmation, and other business rules beyond these responsibilities.
