import type { Selectable } from "kysely";
import type { PackageVersions } from "../../db/types.js";

type Version = Selectable<PackageVersions>;

export const error = (message: string, status: 400 | 404 | 409) => ({ message, status });

export function complete(row: Version, hasIncludedService = false) {
  return !!(row.name.trim() && row.description.trim() && row.terms.trim()
    && row.event_types.length && row.event_types.every(x => x.trim())
    && (row.inclusions.length > 0 || hasIncludedService) && row.inclusions.every(x => x.trim())
    && row.exclusions.every(x => x.trim()) && row.price_amount_minor !== null);
}

export function nextUpdate(previous: Date) {
  return new Date(Math.max(Date.now(), previous.getTime() + 1));
}

