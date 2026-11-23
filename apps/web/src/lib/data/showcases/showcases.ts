import type {
  ShowcaseRecord,
  CreateShowcaseRecord,
  UpdateShowcaseRecord,
} from "@event-management/contracts/showcase";
import { apiBase, request } from "../../http/request";

/** Resolves a /v1/showcase-media/{id} URL for use in <img>/<video> src.
 * Always returns a root-relative path so SSR and client output match,
 * avoiding React hydration mismatches. The browser resolves it correctly
 * against the current origin, which the Vite proxy forwards to the API. */
export const showcaseMediaSrc = (url: string): string => {
  // Already a plain path (sample assets like /images/wedding.jpg) — use as-is.
  if (!url.startsWith("/v1/")) return url;
  // Always return the root-relative path. The dev proxy and production
  // reverse-proxy both forward /v1/* to the API, so this works in all envs.
  return url;
};

type ShowcasePage = {
  showcases: ShowcaseRecord[];
  nextCursor: string | null;
};

export const getAdminShowcases = (cursor?: string): Promise<ShowcasePage> => {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request<ShowcasePage>(`/admin/showcase-records${qs}`);
};

export const getAdminShowcase = (id: string): Promise<ShowcaseRecord> =>
  request<ShowcaseRecord>(`/admin/showcase-records/${encodeURIComponent(id)}`);

export const uploadShowcaseMedia = (file: File): Promise<{
  id: string;
  kind: "image" | "video";
  source: "upload";
  url: string;
  mimeType: string;
}> => {
  const body = new FormData();
  body.set("file", file);
  return request("/admin/showcase-media", body);
};

export const createShowcase = (
  content: CreateShowcaseRecord,
): Promise<ShowcaseRecord> =>
  request<ShowcaseRecord>("/admin/showcase-records", content);

export const updateShowcase = (
  id: string,
  content: UpdateShowcaseRecord,
): Promise<ShowcaseRecord> =>
  request<ShowcaseRecord>(
    `/admin/showcase-records/${encodeURIComponent(id)}`,
    content,
    undefined,
    "PATCH",
  );

export const publishShowcase = (id: string): Promise<ShowcaseRecord> =>
  request<ShowcaseRecord>(
    `/admin/showcase-records/${encodeURIComponent(id)}/publish`,
    undefined,
    undefined,
    "POST",
  );

export const unpublishShowcase = (id: string): Promise<ShowcaseRecord> =>
  request<ShowcaseRecord>(
    `/admin/showcase-records/${encodeURIComponent(id)}/unpublish`,
    undefined,
    undefined,
    "POST",
  );

export const deleteShowcase = (id: string): Promise<void> =>
  request<void>(
    `/admin/showcase-records/${encodeURIComponent(id)}`,
    undefined,
    undefined,
    "DELETE",
  );
