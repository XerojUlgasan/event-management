import type {
  KnowledgeDetail,
  KnowledgePage,
  KnowledgeSearchResponse,
} from "@event-management/contracts/catalog-knowledge";
import { request } from "../../http/request";

export function getKnowledge(query: {
  search: string;
  kind: string;
  status: string;
  cursor?: string;
}) {
  const params = new URLSearchParams({ limit: "20" });
  for (const [key, value] of Object.entries(query))
    if (value) params.set(key, value);
  return request<KnowledgePage>(`/admin/ai/knowledge?${params}`);
}
export function searchKnowledge(query: string) {
  return request<KnowledgeSearchResponse>("/admin/ai/knowledge/search", {
    query,
  });
}
export function getKnowledgeDetail(kind: string, id: string, cursor?: string) {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  return request<KnowledgeDetail>(
    `/admin/ai/knowledge/${kind}/${encodeURIComponent(id)}?${params}`,
  );
}
