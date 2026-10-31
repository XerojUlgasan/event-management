# Service catalog and package assignments

Services are reusable offerings such as a coffee bar, grazing table, magazine booth, photo booth, or tattoo booth. These are examples, not approved catalog records or prices. An administrator creates a service draft and publishes it before assigning it to a package. The same service can be included in one package and offered as a paid add-on in another.

## Records and pricing

- `services` holds a stable service ID and archive timestamp. `service_versions` holds the name, category tags, description, optional image URL, publication state, and immutable published history. A new service draft can use an external HTTPS image URL or a JPEG/PNG upload. A published service retains the image chosen for that version.
- `package_services` links a specific `package_versions` row to a specific `service_versions` row. Every link has its own UUID `id`. A package version cannot link the same service version twice.
- An `included` link has a positive `included_quantity` and no separate price. Its cost is covered by the package's fixed PHP total.
- An `add_on` link has a positive `add_on_unit_price_amount_minor` and `add_on_max_quantity`, with no included quantity. The amount is a fixed PHP price per unit in centavos. The service catalog itself does not set a global price; the package assignment sets the offered add-on price.
- Existing free-text package `inclusions` remain available for non-service inclusions. A package can publish with a textual inclusion or an included structured service. The editor should avoid listing the same benefit in both places.

Publishing a revised service creates a new version. Existing published packages continue to reference the service version they were issued with. To offer the revised service in a package, an administrator edits and republishes that package. Service archival is rejected while a current published package uses it; revise or archive the affected package first. Historical versions and links are retained.

## API and screens

Public `GET /v1/services` and `GET /v1/services/:id` expose current published, non-archived services. The list supports optional `limit` (1–15) and `offset` and returns `nextOffset` for paging; omitting `limit` retains the full-list response. `GET /v1/services/:id/packages` returns current published packages with an included assignment to that service, including an assignment to an older service version. Admin service routes under `/v1/admin/services` support list, detail, draft creation and edit, publish, archive, and deletion of eligible never-published drafts. Admins can upload service images through `/v1/admin/service-images`; R2-backed images are served through `/v1/service-images/:id` when visible under the image rules. Admin writes and reads require the database `admin` role and a valid session. Draft edits and publication use `expectedUpdatedAt` to reject stale changes.

Package create and draft edit requests may include `services`, an array of assignments with `serviceVersionId`, `role`, `includedQuantity`, `addOnPrice`, and `addOnMaxQuantity`. Package responses include each assignment's UUID `id` and the selected service version's details. Only current published, non-archived service versions can be assigned to a new package draft or published package revision. Existing package requests without `services` remain supported.

The admin workspace has a Services sidebar item for creating, editing, and publishing services. Its category field is a removable tag input, and its image field accepts an HTTPS URL or JPEG/PNG upload. Admin and public services appear as image cards. Once published, a service can appear among the first three cards on `/`; View more opens the paged catalog in a full-screen overlay. Service cards open a full-screen preview with details and packages that include the service. The Packages editor assigns published services in its Experience step. Public and customer package previews separate included services from optional priced add-ons. Catalog selection and add-on display do not check availability, submit an inquiry, create a quote, hold a date, or confirm a booking. Staff must confirm capacity and delivery terms before quoting; the availability and quotation workflows remain separate roadmap work.

## Business details to confirm

Before publishing real services, approve each offered configuration and describe its scope clearly, decide which packages include it, set the PHP add-on price per package, and choose the maximum purchasable quantity. Capacity, provider scheduling, and date conflicts still need operating rules before automated availability can be promised. Keep different sellable configurations as separate services until variant rules are defined.
