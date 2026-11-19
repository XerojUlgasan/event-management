import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Markdown,
  Drawer,
  Pagination,
} from "@event-management/ui";
import type {
  KnowledgeDetail,
  KnowledgeListing,
} from "@event-management/contracts/catalog-knowledge";
import { getKnowledgeDetail } from "../../../../lib/data/ai/knowledge";
import { catalogMediaSrc } from "../../../../lib/data/catalog/media";
import { usePagination } from "../../../../lib/pagination/use-pagination";
import {
  formatKnowledgeDate,
  KnowledgeHelp,
  knowledgeStatusLabels,
  KnowledgeStatusBadge,
} from "./KnowledgeDisplay";

export function KnowledgeDetailDrawer({
  item,
  onClose,
}: {
  item: KnowledgeListing;
  onClose: () => void;
}) {
  const [data, setData] = useState<KnowledgeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const seq = useRef(0);
  const pages = usePagination(`${item.kind}:${item.id}`);
  useEffect(() => {
    const current = ++seq.current;
    setLoading(true);
    setError(false);
    void getKnowledgeDetail(item.kind, item.id, pages.cursor)
      .then((result) => {
        if (seq.current === current) setData(result);
      })
      .catch(() => {
        if (seq.current === current) setError(true);
      })
      .finally(() => {
        if (seq.current === current) setLoading(false);
      });
    return () => {
      seq.current++;
    };
  }, [item.id, item.kind, pages.cursor, retry]);
  const listing = data?.listing ?? item;
  return (
    <Drawer
      title={listing.name}
      status={<KnowledgeStatusBadge status={listing.status} />}
      onClose={onClose}
      className="knowledge-drawer"
    >
      <p className="knowledge-detail-meta">
        {listing.kind === "package" ? "Package" : "Service"} ·{" "}
        {listing.indexedChunks} / {listing.expectedChunks} chunks
      </p>
      {error && (
        <p role="alert">
          Could not load content.{" "}
          <Button
            variant="secondary"
            size="small"
            onClick={() => setRetry((n) => n + 1)}
          >
            Try again
          </Button>
        </p>
      )}
      {loading && !data && (
        <div
          className="knowledge-detail-skeleton"
          role="status"
          aria-label="Loading content"
        >
          <span />
          <span />
          <span />
        </div>
      )}
      {data && (
        <div className={loading ? "knowledge-stale" : ""} aria-busy={loading}>
          {data.chunks.length ? (
            data.chunks.map((chunk) => (
              <article className="knowledge-chunk" key={chunk.key}>
                <div className="knowledge-chunk-head">
                  <span>{chunk.kind === "text" ? "Text" : "Photo"}</span>
                  <Badge
                    tone={chunk.status === "indexed" ? "neutral" : "warning"}
                  >
                    {chunk.withdrawn
                      ? "Withdrawn"
                      : knowledgeStatusLabels[chunk.status]}
                  </Badge>
                </div>
                {chunk.withdrawn && (
                  <KnowledgeHelp text="Old content awaiting reconciliation; excluded from coverage." />
                )}
                {chunk.contentMarkdown && (
                  <Markdown source={chunk.contentMarkdown} />
                )}
                {chunk.kind === "photo" && chunk.mediaUrl && (
                  <img
                    src={catalogMediaSrc(chunk.mediaUrl)}
                    alt="Catalog content"
                  />
                )}
                <small>Indexed {formatKnowledgeDate(chunk.embeddedAt)}</small>
              </article>
            ))
          ) : (
            <p>No content chunks.</p>
          )}
          <Pagination
            page={pages.page}
            hasNextPage={!!data.nextCursor}
            pending={loading}
            onPrevious={pages.previous}
            onNext={() => pages.next(data.nextCursor)}
            label="Content pages"
          />
        </div>
      )}
    </Drawer>
  );
}
