import type { PublicPackage } from "../../data/catalog/packages";
import type { PublicService } from "../../data/catalog/services";

function serverApiBase() {
  const proxy = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
  if (proxy) return `${proxy}/functions/v1/api/v1`;
  const configured = process.env.PUBLIC_API_URL ?? "http://127.0.0.1:3000/v1";
  if (/^https?:\/\//.test(configured)) return configured.replace(/\/$/, "");
  return "http://127.0.0.1:3000/v1";
}

async function serverGet<T>(path: string): Promise<T | null> {
  const response = await fetch(`${serverApiBase()}${path}`);
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Catalog request failed (${response.status})`);
  return response.json() as Promise<T>;
}

type Page<T> = { items: T[]; nextCursor: string | null };
async function loadPage<T>(
  kind: "packages" | "services",
  limit?: number,
  cursor?: string,
): Promise<Page<T>> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  const result = await serverGet<
    Record<string, T[]> & { nextCursor: string | null }
  >(`/${kind}?${params}`);
  return {
    items: result?.[kind] ?? [],
    nextCursor: result?.nextCursor ?? null,
  };
}
export const loadPackagesPage = (limit?: number, cursor?: string) =>
  loadPage<PublicPackage>("packages", limit, cursor);
export const loadServicesPage = (limit?: number, cursor?: string) =>
  loadPage<PublicService>("services", limit, cursor);
export const loadPackages = async (limit: number) =>
  (await loadPackagesPage(limit)).items;
export const loadServices = async (limit: number) =>
  (await loadServicesPage(limit)).items;

export async function loadAllCatalog<T>(
  load: (limit?: number, cursor?: string) => Promise<Page<T>>,
) {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await load(undefined, cursor);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

export function catalogPageLinks(url: URL, nextCursor: string | null) {
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const history = url.searchParams.getAll("previous");
  const link = (current: string | undefined, previous: string[]) => {
    const params = new URLSearchParams();
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

export function loadPackage(slug: string) {
  return serverGet<PublicPackage>(`/packages/slug/${encodeURIComponent(slug)}`);
}

export function loadService(slug: string) {
  return serverGet<PublicService>(`/services/slug/${encodeURIComponent(slug)}`);
}
