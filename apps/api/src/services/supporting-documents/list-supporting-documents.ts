import type { Kysely } from "kysely";
import { listSupportingDocumentsData } from "../../data/supporting-documents/list-supporting-documents.js";
import type { DB } from "../../db/types.js";
import { toSupportingDocument } from "./supporting-document-dto.js";

export async function listSupportingDocumentsService(db: Kysely<DB>) {
  return (await listSupportingDocumentsData(db)).map(toSupportingDocument);
}
