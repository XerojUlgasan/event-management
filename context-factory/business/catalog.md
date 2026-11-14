# Catalog

The catalog presents the packages, services, and venues available from Clemora. It helps customers explore their options, start a booking request for a package, and discuss requirements that call for a custom package.

This reference describes intended business behavior. The [current implementation](../../README.md#current-implementation) records what is available today; describing a workflow here does not mean it is already implemented.

## Admin

The admin creates and manages the package, service, and venue listings that customers browse. As defined in [identity and responsibilities](identity.md), admin means the System Administrator.

The admin receives customer requests for a package or venue, discusses the requirements with the customer, and may create a custom package based on those requests. The admin remains responsible for preparing the package and communicating its details to the customer.

## Customer

Customers browse the available packages, services, and venues. They can start a booking request from a package and ask the admin for a package or venue to be added for their event. They explain their requirements to the admin when the listed options need to be tailored.

## Main workflow and handoffs

1. The admin creates catalog listings so customers can see the available options.
2. The customer browses the catalog and can submit a booking request for a chosen package.
3. The customer can also ask the admin for a package or a venue to be added for their event and explain what they need.
4. The admin discusses the request with the customer and may prepare a custom package to suit those requirements. The admin shares the package details with the customer for discussion and agreement.

## Rules and boundaries

- The admin manages listings and prepares custom packages; customers communicate their choices and requests to the admin.
- Browsing or submitting a booking request does not reserve a date, establish a final price, or confirm a booking. The [product scope](../../README.md#product-scope) governs those later decisions.
