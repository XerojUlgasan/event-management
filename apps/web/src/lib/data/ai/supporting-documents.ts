import type {
  SupportingDocument,
  SupportingDocumentSearchResponse,
  SupportingDocumentsResponse,
} from "@event-management/contracts/supporting-documents";
import { request } from "../../http/request";

export function listSupportingDocuments() {
  return request<SupportingDocumentsResponse>("/admin/ai/documents");
}

export function uploadSupportingDocument(file: File) {
  const body = new FormData();
  body.set("file", file);

  return request<SupportingDocument>("/admin/ai/documents", body);
}

export function retrySupportingDocument(id: string) {
  return request<SupportingDocument>(
    `/admin/ai/documents/${encodeURIComponent(id)}/retry`,
    undefined,
    undefined,
    "POST",
  );
}

export function deleteSupportingDocument(id: string) {
  return request<void>(
    `/admin/ai/documents/${encodeURIComponent(id)}`,
    undefined,
    undefined,
    "DELETE",
  );
}

export function searchSupportingDocuments(query: string) {
  return request<SupportingDocumentSearchResponse>(
    "/admin/ai/documents/search",
    { query },
  );
}
