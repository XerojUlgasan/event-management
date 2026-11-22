import { SUPPORTING_DOCUMENT_MAX_BYTES } from "@event-management/contracts/supporting-documents";
import type { SupportingDocument } from "@event-management/contracts/supporting-documents";
import {
  Button,
  DataTable,
  Dialog,
  Input,
  PageHeader,
  notificationErrorMessage,
  useNotifications,
} from "@event-management/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteSupportingDocument,
  listSupportingDocuments,
  retrySupportingDocument,
  uploadSupportingDocument,
} from "../../../../lib/data/ai/supporting-documents";
import { useRequestGeneration } from "../../../../lib/pagination/use-request-generation";
import {
  formatDocumentBytes,
  formatDocumentDate,
  isSupportingDocumentPending,
  mergeSupportingDocuments,
  supportingDocumentPages,
  supportingDocumentUnreadable,
  SupportingDocumentState,
  upsertSupportingDocument,
} from "./SupportingDocumentDisplay";
import { SupportingDocumentTestDialog } from "./SupportingDocumentTestDialog";
import "../../../../styles/ai/supporting-documents.css";

const maxMegabytes = SUPPORTING_DOCUMENT_MAX_BYTES / (1024 * 1024);

function pdfError(file: File) {
  const pdf =
    file.type === "application/pdf" ||
    (file.type === "" && file.name.toLowerCase().endsWith(".pdf"));

  if (!pdf) return "Choose a PDF.";

  if (file.size === 0 || file.size > SUPPORTING_DOCUMENT_MAX_BYTES)
    return `Choose a PDF up to ${maxMegabytes} MB.`;

  return null;
}

export function SupportingDocumentsPage() {
  const { notify, notifyError } = useNotifications();
  const [documents, setDocuments] = useState<SupportingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState<SupportingDocument | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const lists = useRef(new Map<number, Set<string>>());
  const listGeneration = useRequestGeneration();
  const pollError = useRef("");

  const remember = (id: string) => {
    for (const ids of lists.current.values()) ids.add(id);
  };

  const load = useCallback(
    async (source: "open" | "refresh" | "poll") => {
      if (source === "poll" && lists.current.size > 0) return;

      const id = listGeneration.bump();
      const newerIds = new Set<string>();
      lists.current.set(id, newerIds);

      if (source === "open") setLoading(true);

      if (source === "refresh") setRefreshing(true);

      try {
        const result = await listSupportingDocuments();

        if (!listGeneration.isCurrent(id)) return;

        setDocuments((current) =>
          newerIds.size
            ? mergeSupportingDocuments(current, result.documents, newerIds)
            : result.documents,
        );
        setLoadError("");
        pollError.current = "";
      } catch (cause) {
        if (!listGeneration.isCurrent(id)) return;

        const fallback = "Could not load supporting documents.";
        const message = notificationErrorMessage(cause, fallback);
        setLoadError(message);

        if (source === "poll" && pollError.current === message) return;

        if (source === "poll") pollError.current = message;
        else pollError.current = "";

        notifyError(cause, fallback);
      } finally {
        lists.current.delete(id);

        if (!listGeneration.isCurrent(id)) return;

        setLoading(false);
        setRefreshing(false);
      }
    },
    [listGeneration, notifyError],
  );

  useEffect(() => {
    void load("open");

    return () => {
      listGeneration.bump();
    };
  }, [listGeneration, load]);

  const pending = documents.some((document) =>
    isSupportingDocumentPending(document.state),
  );

  useEffect(() => {
    if (!pending) return;

    const timer = window.setInterval(() => void load("poll"), 4000);

    return () => window.clearInterval(timer);
  }, [pending, load]);

  async function upload(file: File) {
    const invalid = pdfError(file);

    if (invalid) {
      setActionError(invalid);

      return;
    }

    setUploading(true);
    setActionError("");

    try {
      const row = await uploadSupportingDocument(file);
      remember(row.id);
      setDocuments((current) => upsertSupportingDocument(current, row));
      notify(`Uploaded ${row.originalFilename}.`);
    } catch (cause) {
      setActionError(notifyError(cause, "Could not upload the PDF."));
    } finally {
      setUploading(false);
    }
  }

  async function retry(document: SupportingDocument) {
    setRetryingId(document.id);
    setActionError("");

    try {
      const row = await retrySupportingDocument(document.id);
      remember(row.id);
      setDocuments((current) => upsertSupportingDocument(current, row));
      notify(`Retrying ${row.originalFilename}.`);
    } catch (cause) {
      setActionError(
        notifyError(cause, `Could not retry ${document.originalFilename}.`),
      );
    } finally {
      setRetryingId((current) => (current === document.id ? null : current));
    }
  }

  async function remove(document: SupportingDocument) {
    setDeletePending(true);
    setDeleteError("");

    try {
      await deleteSupportingDocument(document.id);
      remember(document.id);
      setDocuments((current) =>
        current.filter((row) => row.id !== document.id),
      );
      setDeleting(null);
      notify(`Deleted ${document.originalFilename}.`);
      requestAnimationFrame(() =>
        uploadButton.current?.focus({ preventScroll: true }),
      );
    } catch (cause) {
      setDeleteError(
        notificationErrorMessage(cause, "Could not delete the document."),
      );
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="supporting-documents">
      <PageHeader
        title="Supporting Documents"
        actions={
          <div className="supporting-documents-actions">
            <Input
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              disabled={uploading}
              aria-label="Choose a PDF"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";

                if (file) void upload(file);
              }}
            />
            <Button
              icon="plus"
              ref={uploadButton}
              pending={uploading}
              title={`PDF up to ${maxMegabytes} MB`}
              onClick={() => input.current?.click()}
            >
              Upload PDF
            </Button>
            <Button
              variant="secondary"
              size="icon"
              icon="refresh"
              aria-label="Refresh"
              title="Refresh"
              pending={refreshing}
              disabled={loading}
              onClick={() => void load("refresh")}
            />
            <Button
              variant="secondary"
              size="icon"
              icon="flask"
              aria-label="Test document search"
              aria-haspopup="dialog"
              title="Test document search"
              onClick={() => setTesting(true)}
            />
          </div>
        }
      />
      {actionError && (
        <p role="alert" className="supporting-documents-error">
          {actionError}
        </p>
      )}
      {loadError && (
        <div role="alert" className="supporting-documents-error">
          {loadError}{" "}
          <Button
            variant="secondary"
            size="small"
            onClick={() => void load("refresh")}
          >
            Try again
          </Button>
        </div>
      )}
      {loading && !documents.length ? (
        <p role="status">Loading supporting documents…</p>
      ) : loadError && !documents.length ? null : (
        <div aria-busy={refreshing || undefined}>
          <DataTable
            label="Supporting documents"
            className="supporting-documents-table"
            minWidth={0}
            rows={documents}
            rowKey={(document) => document.id}
            emptyMessage={`Upload a PDF with selectable text, up to ${maxMegabytes} MB.`}
            columns={[
              {
                key: "file",
                header: "File",
                cell: (document) => {
                  const unreadable = supportingDocumentUnreadable(
                    document.unreadablePages,
                  );
                  const pages = supportingDocumentPages(document);

                  return (
                    <span className="supporting-documents-file-name">
                      <strong>{document.originalFilename}</strong>
                      <span>
                        {[
                          pages,
                          formatDocumentBytes(document.byteSize),
                          formatDocumentDate(document.createdAt),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {unreadable && <span>{unreadable}</span>}
                    </span>
                  );
                },
              },
              {
                key: "outcome",
                header: "Status",
                cell: (document) => (
                  <div className="supporting-documents-row-status">
                    <SupportingDocumentState document={document} />
                    {document.canRetry && (
                      <Button
                        variant="secondary"
                        size="small"
                        icon="refresh"
                        pending={retryingId === document.id}
                        disabled={
                          retryingId !== null && retryingId !== document.id
                        }
                        aria-label={`Retry ${document.originalFilename}`}
                        onClick={() => void retry(document)}
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                cell: (document) => (
                  <Button
                    variant="secondary"
                    size="icon"
                    icon="trash"
                    aria-label={`Delete ${document.originalFilename}`}
                    aria-haspopup="dialog"
                    title="Delete document"
                    disabled={retryingId === document.id}
                    onClick={() => {
                      setDeleteError("");
                      setDeleting(document);
                    }}
                  />
                ),
              },
            ]}
          />
        </div>
      )}
      {testing && (
        <SupportingDocumentTestDialog onClose={() => setTesting(false)} />
      )}
      {deleting && (
        <Dialog
          title="Delete supporting document?"
          className="supporting-document-delete"
          intro={
            <>
              This permanently deletes{" "}
              <strong>{deleting.originalFilename}</strong> and its embeddings.
            </>
          }
          initialFocus={cancelDelete}
          onClose={() => {
            if (!deletePending) setDeleting(null);
          }}
          actions={
            <>
              <Button
                ref={cancelDelete}
                variant="secondary"
                disabled={deletePending}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                pending={deletePending}
                onClick={() => void remove(deleting)}
              >
                {deletePending ? "Deleting…" : "Delete document"}
              </Button>
            </>
          }
        >
          {deleteError && (
            <p role="alert" className="supporting-documents-error">
              {deleteError}
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
