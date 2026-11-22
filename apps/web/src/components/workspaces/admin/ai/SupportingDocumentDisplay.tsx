import { Badge, type BadgeTone } from "@event-management/ui";
import {
  SUPPORTING_DOCUMENT_MAX_PAGES,
  type SupportingDocument,
} from "@event-management/contracts/supporting-documents";

const stateLabels: Record<SupportingDocument["state"], string> = {
  extracting: "Reading PDF",
  embedding: "Processing",
  ready: "Ready",
  needs_review: "Needs review",
  failed: "Failed",
};

const stateTones: Record<SupportingDocument["state"], BadgeTone> = {
  extracting: "info",
  embedding: "info",
  ready: "success",
  needs_review: "warning",
  failed: "danger",
};

export function isSupportingDocumentPending(
  state: SupportingDocument["state"],
) {
  return state === "extracting" || state === "embedding";
}

export function formatDocumentBytes(bytes: number) {
  const megabytes = bytes / (1024 * 1024);

  if (megabytes >= 1)
    return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;

  const kilobytes = bytes / 1024;

  if (kilobytes >= 1)
    return `${kilobytes >= 10 ? Math.round(kilobytes) : kilobytes.toFixed(1)} KB`;

  return `${bytes} B`;
}

export function formatDocumentDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function supportingDocumentPages(document: SupportingDocument) {
  if (document.pageCount === null) return null;

  return document.pageCount === 1 ? "1 page" : `${document.pageCount} pages`;
}

export function supportingDocumentUnreadable(pages: number[]) {
  if (!pages.length) return null;

  const numbers = pages.join(", ");

  return pages.length === 1
    ? `Page ${numbers} unreadable`
    : `Pages ${numbers} unreadable`;
}

export function supportingDocumentProgress(document: SupportingDocument) {
  if (document.state === "embedding" && document.chunkCount > 0)
    return `${document.embeddedCount} of ${document.chunkCount} sections ready`;

  if (document.failedCount > 0)
    return document.failedCount === 1
      ? "1 section failed"
      : `${document.failedCount} sections failed`;

  if (document.state === "failed" && !document.canRetry) {
    switch (document.problem) {
      case "encrypted":
        return "Upload an unlocked PDF.";
      case "no_text":
        return "No selectable text found.";
      case "page_limit":
        return `Upload up to ${SUPPORTING_DOCUMENT_MAX_PAGES} pages.`;
      default:
        return "Try uploading a new copy.";
    }
  }

  return null;
}

export function SupportingDocumentState({
  document,
}: {
  document: SupportingDocument;
}) {
  const progress = supportingDocumentProgress(document);

  return (
    <span className="supporting-documents-outcome">
      <Badge tone={stateTones[document.state]}>
        {stateLabels[document.state]}
      </Badge>
      {progress && <span>{progress}</span>}
    </span>
  );
}

export function mergeSupportingDocuments(
  current: readonly SupportingDocument[],
  incoming: readonly SupportingDocument[],
  newerIds: ReadonlySet<string>,
) {
  const incomingIds = new Set(incoming.map((document) => document.id));

  const kept = current.filter(
    (document) => newerIds.has(document.id) && !incomingIds.has(document.id),
  );

  const rows = incoming.map((document) =>
    newerIds.has(document.id)
      ? (current.find((item) => item.id === document.id) ?? document)
      : document,
  );

  return [...kept, ...rows];
}

export function upsertSupportingDocument(
  current: readonly SupportingDocument[],
  row: SupportingDocument,
) {
  const index = current.findIndex((document) => document.id === row.id);

  if (index === -1) return [row, ...current];

  return current.map((document) => (document.id === row.id ? row : document));
}
