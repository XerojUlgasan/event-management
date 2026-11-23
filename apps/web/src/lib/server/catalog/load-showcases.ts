import type { ShowcaseRecord } from "@event-management/contracts/showcase";
import { env } from "../config/env";

async function serverGet<T>(path: string): Promise<T | null> {
  const response = await fetch(`${env.SERVER_API_URL}${path}`);
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Showcase request failed (${response.status})`);
  return response.json() as Promise<T>;
}

type ShowcasePage = { showcases: ShowcaseRecord[]; nextCursor: string | null };

export const loadShowcasesPage = (
  limit?: number,
  cursor?: string,
): Promise<ShowcasePage> => {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return serverGet<ShowcasePage>(
    `/showcase-records${qs ? `?${qs}` : ""}`,
  ).then((r) => ({
    showcases: r?.showcases ?? [],
    nextCursor: r?.nextCursor ?? null,
  }));
};

export const loadShowcases = async (limit: number): Promise<ShowcaseRecord[]> =>
  (await loadShowcasesPage(limit)).showcases;

export const loadShowcase = (slug: string): Promise<ShowcaseRecord | null> =>
  serverGet<ShowcaseRecord>(
    `/showcase-records/${encodeURIComponent(slug)}`,
  );

export function showcasePageLinks(url: URL, nextCursor: string | null) {
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
    next: nextCursor
      ? link(nextCursor, [...history, cursor ?? ""])
      : null,
  };
}
