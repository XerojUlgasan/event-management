import type {
  ShowcaseRecord,
  CreateShowcaseRecord,
  UpdateShowcaseRecord,
} from "@event-management/contracts/showcase";
import { SHOWCASE_LIST_PAGE_SIZE } from "@event-management/contracts/limits/showcase";
import { publicApiUrl, request } from "../../http/request";

/** Keep SSR and browser media URLs identical for both API origins and proxies. */
export const showcaseMediaSrc = (url: string): string => {
  if (!url.startsWith("/v1/showcase-media/")) return url;

  return `${publicApiUrl}${url.slice("/v1".length)}`;
};

export type ShowcasePage = {
  showcases: ShowcaseRecord[];
  nextCursor: string | null;
};

export const getPublicShowcasesPage = (
  cursor: string,
): Promise<ShowcasePage> => {
  const params = new URLSearchParams({
    cursor,
    limit: String(SHOWCASE_LIST_PAGE_SIZE),
  });

  return request<ShowcasePage>(`/showcase-records?${params}`);
};

export const getAdminShowcases = (
  status: "published" | "drafts",
  search: string,
  cursor?: string,
): Promise<ShowcasePage> => {
  const params = new URLSearchParams({ status });

  if (search) params.set("search", search);

  if (cursor) params.set("cursor", cursor);

  return request<ShowcasePage>(`/admin/showcase-records?${params}`);
};

export const getAdminShowcase = (id: string): Promise<ShowcaseRecord> =>
  request<ShowcaseRecord>(`/admin/showcase-records/${encodeURIComponent(id)}`);

export const uploadShowcaseMedia = (
  file: File,
): Promise<{
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
