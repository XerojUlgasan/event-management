import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { SUPPORTING_DOCUMENT_MAX_BYTES } from "@event-management/contracts/supporting-documents";
import { createSupportingDocumentData } from "../../data/supporting-documents/create-supporting-document.js";
import { listSupportingDocumentsData } from "../../data/supporting-documents/list-supporting-documents.js";
import { supportingDocumentExistsData } from "../../data/supporting-documents/supporting-document-exists.js";
import type { DB } from "../../db/types.js";
import { enqueueBackgroundJobService } from "../background-jobs/enqueue-job.js";
import { supportingDocumentPipeline } from "./document-pipeline.js";
import {
  deleteSupportingDocument,
  documentSha256,
  putSupportingDocument,
} from "./document-storage.js";
import { toSupportingDocument } from "./supporting-document-dto.js";

export async function uploadSupportingDocumentService(
  db: Kysely<DB>,
  actorId: string,
  file: File,
) {
  if (file.size > SUPPORTING_DOCUMENT_MAX_BYTES)
    return { status: 413 as const, message: "Choose a PDF up to 25 MB." };

  const filename = file.name.trim();

  if (!filename || filename.length > 255 || file.size < 5)
    return { status: 400 as const, message: "Choose a valid PDF file." };

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")
    return { status: 400 as const, message: "Choose a valid PDF file." };

  const id = randomUUID();
  const key = `${id}.pdf`;

  try {
    await putSupportingDocument(key, bytes);
  } catch {
    // Storage may have accepted the object even when its response was lost.
    await deleteSupportingDocument(key).catch(() => {});

    return {
      status: 502 as const,
      message: "Could not store the PDF. Try uploading it again.",
    };
  }

  try {
    return await db.transaction().execute(async (trx) => {
      await createSupportingDocumentData(trx, {
        id,
        original_filename: filename,
        storage_key: key,
        mime_type: "application/pdf",
        byte_size: bytes.length,
        file_sha256: documentSha256(bytes),
        uploaded_by: actorId,
        pipeline_version: supportingDocumentPipeline,
      });
      const [document] = await listSupportingDocumentsData(trx, id);

      if (!document) throw new Error("Saved supporting document was not found");

      await enqueueBackgroundJobService(trx, "extract_supporting_document", {
        documentId: id,
      });

      return toSupportingDocument(document);
    });
  } catch (error) {
    // A commit can succeed even if its acknowledgement is lost. Prefer retaining
    // the file when we cannot establish that the document row is absent.
    const stored = await supportingDocumentExistsData(db, id).catch(() => true);

    if (!stored) await deleteSupportingDocument(key).catch(() => {});

    throw error;
  }
}
