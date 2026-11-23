import type { CatalogMedia } from "@event-management/contracts/catalog";
import { apiBase, request } from "../../http/request";

export const uploadCatalogMedia = (file: File) => {
  const body = new FormData();
  body.set("file", file);

  return request<CatalogMedia>("/admin/catalog-media", body);
};

export const deleteCatalogMedia = (id: string) =>
  request<void>(
    `/admin/catalog-media/${encodeURIComponent(id)}`,
    undefined,
    undefined,
    "DELETE",
  );

export const catalogMediaSrc = (url: string) => {
  if (!url.startsWith("/v1/")) return url;

  const base = apiBase();

  if (!/^https?:\/\//.test(base)) return url;

  return new URL(url, `${base}/`).href;
};
