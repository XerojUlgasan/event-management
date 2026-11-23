import type { PublicPackage } from "../../data/catalog/packages";
import type { PublicService } from "../../data/catalog/services";
import {
  EVENT_TYPES,
  type CatalogFilters,
  type CatalogKind,
} from "@event-management/contracts/catalog-filters";
import { env } from "../config/env";

export function readCatalogFilters(
  kind: CatalogKind,
  params: URLSearchParams,
): CatalogFilters {
  const eventType = params.get("eventType");
  const requestedPricing = params.get("pricingType");
  const pricingType =
    kind === "services" &&
    (requestedPricing === "fixed" || requestedPricing === "hourly")
      ? requestedPricing
      : undefined;
  const priceRangeType = params.get("priceRangeType");
  // Native GET can submit the old price fields after the pricing select changes.
  const hasPrice =
    kind === "packages" ||
    (pricingType !== undefined &&
      (priceRangeType === null || priceRangeType === pricingType));

  const readNumber = (key: string) => {
    const value = params.get(key);

    return value ? Number(value) : undefined;
  };

  return {
    eventType: EVENT_TYPES.find((type) => type === eventType),
    pricingType,
    minPricePesos: hasPrice ? readNumber("minPricePesos") : undefined,
    maxPricePesos: hasPrice ? readNumber("maxPricePesos") : undefined,
    guests: kind === "packages" ? readNumber("guests") : undefined,
  };
}

async function serverGet<T>(path: string): Promise<T | null> {
  const response = await fetch(`${env.SERVER_API_URL}${path}`);

  if (response.status === 404) return null;

  if (!response.ok)
    throw new Error(`Catalog request failed (${response.status})`);

  return response.json() as Promise<T>;
}

function buildParams(filters: CatalogFilters, limit?: number, cursor?: string) {
  const params = new URLSearchParams();

  if (limit !== undefined) params.set("limit", String(limit));

  if (cursor) params.set("cursor", cursor);

  if (filters.eventType) params.set("eventType", filters.eventType);

  if (filters.minPricePesos !== undefined)
    params.set("minPricePesos", String(filters.minPricePesos));

  if (filters.maxPricePesos !== undefined)
    params.set("maxPricePesos", String(filters.maxPricePesos));

  if (filters.guests !== undefined)
    params.set("guests", String(filters.guests));

  if (filters.pricingType !== undefined)
    params.set("pricingType", filters.pricingType);

  return params;
}

type Page<T> = { items: T[]; nextCursor: string | null };

export const loadPackagesPage = (
  filters: CatalogFilters = {},
  limit?: number,
  cursor?: string,
): Promise<Page<PublicPackage>> =>
  serverGet<{ packages: PublicPackage[]; nextCursor: string | null }>(
    `/packages?${buildParams(filters, limit, cursor)}`,
  ).then((r) => ({
    items: r?.packages ?? [],
    nextCursor: r?.nextCursor ?? null,
  }));

export const loadServicesPage = (
  filters: CatalogFilters = {},
  limit?: number,
  cursor?: string,
): Promise<Page<PublicService>> =>
  serverGet<{ services: PublicService[]; nextCursor: string | null }>(
    `/services?${buildParams(filters, limit, cursor)}`,
  ).then((r) => ({
    items: r?.services ?? [],
    nextCursor: r?.nextCursor ?? null,
  }));

export const loadPackages = async (limit: number) =>
  (await loadPackagesPage({}, limit)).items;

export const loadServices = async (limit: number) =>
  (await loadServicesPage({}, limit)).items;

export async function loadAllCatalog<T>(
  load: (
    filters?: CatalogFilters,
    limit?: number,
    cursor?: string,
  ) => Promise<Page<T>>,
) {
  const items: T[] = [];
  let cursor: string | undefined;

  do {
    const page = await load({}, undefined, cursor);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return items;
}

export function catalogPageLinks(
  url: URL,
  nextCursor: string | null,
  filters: CatalogFilters = {},
) {
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const history = url.searchParams.getAll("previous");

  const link = (current: string | undefined, previous: string[]) => {
    // Preserve active filter params across page navigation.
    const params = buildParams(filters);

    if (current) params.set("cursor", current);

    for (const item of previous) params.append("previous", item);

    const query = params.toString();

    return `${url.pathname}${query ? `?${query}` : ""}`;
  };

  return {
    previous: history.length
      ? link(history.at(-1) || undefined, history.slice(0, -1))
      : null,
    next: nextCursor ? link(nextCursor, [...history, cursor ?? ""]) : null,
  };
}

export function loadPackage(slug: string, id?: string) {
  if (id)
    return serverGet<PublicPackage>(`/packages/${encodeURIComponent(id)}`);

  return serverGet<PublicPackage>(`/packages/slug/${encodeURIComponent(slug)}`);
}

export function loadService(slug: string, id?: string) {
  if (id)
    return serverGet<PublicService>(`/services/${encodeURIComponent(id)}`);

  return serverGet<PublicService>(`/services/slug/${encodeURIComponent(slug)}`);
}
