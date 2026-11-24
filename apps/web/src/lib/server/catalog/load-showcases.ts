import type { ShowcaseRecord } from "@event-management/contracts/showcase";
import type { ShowcasePage } from "../../data/showcases/showcases";
import { serverApiUrl } from "../http/api-url";

async function serverGet<T>(
  path: string,
  allowMissing = false,
): Promise<T | null> {
  const response = await fetch(`${serverApiUrl()}${path}`);

  if (allowMissing && response.status === 404) return null;

  if (!response.ok)
    throw new Error(`Showcase request failed (${response.status})`);

  return response.json() as Promise<T>;
}

export const loadShowcasesPage = (
  limit?: number,
  cursor?: string,
): Promise<ShowcasePage> => {
  const params = new URLSearchParams();

  if (limit !== undefined) params.set("limit", String(limit));

  if (cursor) params.set("cursor", cursor);

  const qs = params.toString();

  return serverGet<ShowcasePage>(`/showcase-records${qs ? `?${qs}` : ""}`).then(
    (r) => ({
      showcases: r?.showcases ?? [],
      nextCursor: r?.nextCursor ?? null,
    }),
  );
};

export const loadShowcases = async (limit: number): Promise<ShowcaseRecord[]> =>
  (await loadShowcasesPage(limit)).showcases;

export const loadShowcase = (slug: string): Promise<ShowcaseRecord | null> =>
  serverGet<ShowcaseRecord>(
    `/showcase-records/${encodeURIComponent(slug)}`,
    true,
  );
