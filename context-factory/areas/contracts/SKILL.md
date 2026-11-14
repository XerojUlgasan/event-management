---
name: event-management-limits
description: Change shared validation limits, API transport caps, or synchronize API and browser types.
---

# Contracts

- For validation limits, client hints, or HTTP body caps, read [shared limits](references/shared-limits.md). Domain constants belong to `@event-management/contracts`, route schemas enforce them, and HTTP transport caps belong to the API.
- For route payloads, status, nullability, pagination, or shared types, read [API and type synchronization](references/api-type-sync.md). Update the affected producers and consumers together and verify their actual contract.
