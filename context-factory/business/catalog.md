# Catalog

The catalog presents the packages and services available from Clemora. It helps customers explore their options, start a booking request for a package, and discuss requirements that call for a custom package.

This reference describes intended business behavior. The [current implementation](../../README.md#current-implementation) records what is available today; describing a workflow here does not mean it is already implemented.

## Admin

The admin creates and manages the package and service listings that customers browse. As defined in [identity and responsibilities](identity.md), admin means a designated System Administrator.

The admin receives customer requests for a package or service, discusses the requirements with the customer, and may create a custom package based on those requests. The physical event location is part of the booking request, not a catalog listing. The admin remains responsible for preparing the package and communicating its details to the customer.

## Customer

Customers browse the available packages and services. They can start a booking request from a package and ask the admin for a package or service to be added for their event. They provide the physical event location with their request and explain any requirements that need discussion.

## Main workflow and handoffs

1. The admin creates catalog listings so customers can see the available options.
2. The customer browses the catalog and can submit a booking request for a chosen package. They can also submit from a conversation without selecting a package and discuss a custom arrangement.
3. The customer can also ask the admin for a package or service to be added for their event and explain what they need.
4. The admin discusses the request with the customer and may prepare a private custom package from scratch or a catalog copy. For a request without any package, the admin may instead assign an available catalog package. The admin shares the package details with the customer for discussion and agreement.

## Rules and boundaries

- The admin manages listings and prepares custom packages; customers communicate their choices and requests to the admin.
- A service lists either an hourly-only rate or one fixed price covering a positive whole number of included hours, plus an hourly rate for excess time. No rounding rule is specified for partial excess hours. These are catalog terms and do not automatically calculate quotation amounts.
- A service widget features a linked catalog service within a package or service page. Its placement does not itself establish inclusion, an additional charge, or availability; the administrator can explain the context in its caption. Package pricing and quotations retain their existing owners.
- Browsing or submitting a booking request does not reserve a date, establish a final price, or confirm a booking. The [product scope](../../README.md#product-scope) governs those later decisions.
