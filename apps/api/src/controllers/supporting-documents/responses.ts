import { supportingDocumentSchema } from "@event-management/contracts/supporting-documents";
import { openapiJson } from "../../utils/openapi.js";

export const tags = ["AI supporting documents"];

export const accepted = {
  description: "Document processing accepted",
  content: openapiJson(supportingDocumentSchema),
};

export const errors = {
  401: { description: "Not signed in" },
  403: { description: "Admin access required" },
  400: { description: "Invalid request or cursor" },
};
