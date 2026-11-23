import type { Kysely } from "kysely";
import {
  deleteSupportingDocumentData,
  getSupportingDocumentStorageKeyData,
} from "../../data/supporting-documents/delete-supporting-document.js";
import type { DB } from "../../db/types.js";
import { deleteSupportingDocument } from "./document-storage.js";

export async function deleteSupportingDocumentService(
  db: Kysely<DB>,
  id: string,
) {
  const document = await getSupportingDocumentStorageKeyData(db, id);

  if (!document) return;

  // Keep the immutable Storage key available for retry until the PDF is gone.
  try {
    await deleteSupportingDocument(document.storage_key);
  } catch {
    return {
      status: 502 as const,
      message: "Could not delete the stored PDF. Try again.",
    };
  }

  // The foreign key cascades to chunks and their vectors in the same write.
  await deleteSupportingDocumentData(db, id);
}
