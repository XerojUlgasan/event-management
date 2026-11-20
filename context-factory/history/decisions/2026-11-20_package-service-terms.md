# Package service terms and private add-ons

Date: 2026-11-20
Status: accepted
Authority: User approved package-owned included-service overrides and custom-only JSONB add-ons, then requested implementation; quotations explicitly deferred.
Implementation: implemented; see [run](../../runs/2026-11-20_23-03-00_package-service-terms.md)

## Problem

Service widgets previously referenced listings without defining inclusion. The user needs package-specific coverage and rates without adding an included service's base fee again or changing the global service catalog.

## Decision

- A service widget inside a package means included in that package's fixed total. Its `serviceTerms` stores copied/default or locally edited included hours and excess hourly rate. Service-page references remain neutral.
- A private custom package may additionally own an `addonServices` JSONB array. Each entry references a reusable service and stores its local fixed price, covered hours and hourly rate, or hourly-only pricing. Catalog packages cannot contain add-ons.
- Defaults are copied when a service is attached or explicitly reset. Subsequent catalog edits do not rewrite package terms. Missing legacy terms remain unspecified until an admin saves them.
- The existing service picker and direct three-dot settings dialog pattern own selection and editing. Adding or editing services never recalculates the package base price.
- Quotation calculations, automatic add-on charges, partial-hour rounding, and structured quotation-term snapshots are deferred. Existing financial quotations remain unchanged.

## Alternatives considered

- A relational assignment table would support independent row operations but add a second save lifecycle to this whole-package editor. The user chose package-owned JSONB.
- Live inheritance would refresh current defaults automatically but could silently change saved customer arrangements. Explicit copying preserves their local terms.

## Rationale

The package already owns a JSONB canvas and a revision-checked save. The private add-on list shares that ownership and transaction boundary. Existing schema, service validation and read projections must preserve both JSONB forms.

## Consequences

Add-on service references need application validation and deletion protection. Historical package audits must accept absent new fields. Customer and AI reads must convey local terms without treating them as automatic quotation charges. Existing service-reference decisions remain historical; this decision supersedes their neutral semantics only for service widgets inside packages.

## References

- [Catalog rules](../../business/catalog.md)
- [Quotation rules](../../business/quotations.md)
- [Earlier reference-only widget](2026-11-17_service-widget.md)
- [Earlier assignment removal](2026-11-18_remove-package-service-assignments.md)
