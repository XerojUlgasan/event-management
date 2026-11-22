import type {
  SupportingDocument,
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
