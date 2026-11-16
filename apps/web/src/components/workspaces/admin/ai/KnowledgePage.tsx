import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Badge,
  Button,
  CatalogMarkdown,
  DataTable,
  Drawer,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  Select,
} from "@event-management/ui";
import type {
  KnowledgeDetail,
  KnowledgeListing,
  KnowledgePage as Page,
  KnowledgeStatus,
} from "@event-management/contracts/catalog-knowledge";
import {
  getKnowledge,
  getKnowledgeDetail,
} from "../../../../lib/data/ai/knowledge";
import { catalogMediaSrc } from "../../../../lib/data/catalog/media";
import { navigateWorkspace } from "../../../../lib/navigation/workspace-navigation";
import { usePagination } from "../../../../lib/pagination/use-pagination";
import { KnowledgeSearch } from "./KnowledgeSearch";
import "../../../../styles/ai/knowledge.css";

// Dashboard design follows the existing light-only Clemora palette. KPI tiles compose
// Panel because StatCard requires an unrelated menu and detail.
const labels: Record<KnowledgeStatus, string> = {
  indexed: "Indexed",
  partial: "Partial",
  pending: "Pending",
  "needs-refresh": "Needs refresh",
};
const coverageHelp =
  "Coverage means the current source identity, preprocessing and model match a successful embedding. It does not re-download photos or prove assistant retrieval.";
function date(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
}
function Help({ text }: { text: string }) {
  const id = useId();
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    setPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - 100),
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      width,
    });
  };
  useEffect(() => {
    if (!position) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setPosition(null);
      }
    };
    const scroll = () => setPosition(null);
    window.addEventListener("keydown", dismiss, true);
    window.addEventListener("scroll", scroll, true);
    return () => {
      window.removeEventListener("keydown", dismiss, true);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [position]);
  return (
    <span
      className="knowledge-help"
      tabIndex={0}
      aria-label="Help"
      aria-describedby={position ? id : undefined}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={() => setPosition(null)}
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => setPosition(null)}
    >
      ?
      {position && (
        <span
          id={id}
          role="tooltip"
          className="knowledge-tooltip"
          style={position}
        >
          {text}
        </span>
      )}
    </span>
  );
}
function Status({ status }: { status: KnowledgeStatus }) {
  return (
    <Badge tone={status === "indexed" ? "neutral" : "warning"}>
      {labels[status]}
    </Badge>
  );
}

function Metric({
  label,
  indexed,
  total,
  attention,
  selected,
  onClick,
}: {
  label: string;
  indexed: number;
  total: number;
  attention?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const ratio = total ? indexed / total : 0;
  return (
    <Panel
      className={`knowledge-metric${attention && indexed ? " knowledge-metric-alert" : ""}${selected ? " knowledge-metric-selected" : ""}`}
    >
      <div className="knowledge-metric-label">
        {label}{" "}
        <Help
          text={
            attention
              ? "Eligible listings that are partial, pending, or need refresh. Select to filter the table."
              : coverageHelp
          }
        />
      </div>
      {onClick ? (
        <Button
          variant="plain"
          className="knowledge-metric-button"
          aria-pressed={selected}
          onClick={onClick}
        >
          <strong>{indexed}</strong>
          <span> / {total}</span>
        </Button>
      ) : (
        <div className="knowledge-metric-value">
          <strong>{total ? `${(ratio * 100).toFixed(1)}%` : "—"}</strong>
          <span>
            {indexed} / {total}
          </span>
        </div>
      )}
      <div className="knowledge-target">
        <span>Target {attention ? "0" : "100%"}</span>
      </div>
      <div className="knowledge-track" aria-hidden="true">
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
    </Panel>
  );
}

function Detail({
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
      status={<Status status={listing.status} />}
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
                    {chunk.withdrawn ? "Withdrawn" : labels[chunk.status]}
                  </Badge>
                </div>
                {chunk.withdrawn && (
                  <Help text="Old content awaiting reconciliation; excluded from coverage." />
                )}
                {chunk.contentMarkdown && (
                  <CatalogMarkdown source={chunk.contentMarkdown} />
                )}
                {chunk.kind === "photo" && chunk.mediaUrl && (
                  <img
                    src={catalogMediaSrc(chunk.mediaUrl)}
                    alt="Catalog content"
                  />
                )}
                <small>Indexed {date(chunk.embeddedAt)}</small>
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

export function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [detail, setDetail] = useState<KnowledgeListing | null>(null);
  const seq = useRef(0);
  const pages = usePagination(`${search}:${kind}:${status}`);
  const load = useCallback(() => setRetry((n) => n + 1), []);
  useEffect(() => {
    const current = ++seq.current;
    setLoading(true);
    setError(false);
    void getKnowledge({ search, kind, status, cursor: pages.cursor })
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
  }, [search, kind, status, pages.cursor, retry]);
  return (
    <div className="knowledge-page">
      <PageHeader
        title="Knowledge Catalog"
        actions={
          <div className="knowledge-header-actions">
            <Badge tone="neutral">
              Assistant catalog search: Not connected
            </Badge>
            <Help text="The assistant is not connected to catalog search." />
            <Button variant="secondary" onClick={load} pending={loading}>
              Refresh
            </Button>
          </div>
        }
      />
      <KnowledgeSearch />
      {error && (
        <div role="alert" className="knowledge-error">
          Could not load knowledge catalog.{" "}
          <Button variant="secondary" size="small" onClick={load}>
            Try again
          </Button>
        </div>
      )}
      {!data && loading && (
        <div
          className="knowledge-skeleton"
          role="status"
          aria-label="Loading knowledge catalog"
        >
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
      {data && (
        <div className={loading ? "knowledge-stale" : ""} aria-busy={loading}>
          <div className="knowledge-overview-heading">
            All eligible catalog{" "}
            <Help text="These totals cover all eligible listings and do not change with table filters." />
          </div>
          <div className="knowledge-metrics">
            <Metric
              label="Packages indexed"
              indexed={data.summary.packages.indexed}
              total={data.summary.packages.total}
            />
            <Metric
              label="Services indexed"
              indexed={data.summary.services.indexed}
              total={data.summary.services.total}
            />
            <Metric
              label="Needs attention"
              indexed={data.summary.attention}
              total={data.summary.total}
              attention
              selected={status === "attention"}
              onClick={() =>
                setStatus(status === "attention" ? "" : "attention")
              }
            />
          </div>
          <Panel className="knowledge-table-panel">
            <div className="knowledge-table-heading">
              <h2>Catalog listings</h2>
              <span>{data.filteredCount} listings</span>
            </div>
            <div className="knowledge-filters">
              <SearchField
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value.slice(0, 200))
                }
                placeholder="Search listings"
                ariaLabel="Search listings"
              />
              <Select
                aria-label="Filter by kind"
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option value="">All kinds</option>
                <option value="package">Packages</option>
                <option value="service">Services</option>
              </Select>
              <Select
                aria-label="Filter by status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="attention">Needs attention</option>
                <option value="indexed">Indexed</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
                <option value="needs-refresh">Needs refresh</option>
              </Select>
            </div>
            <div className="knowledge-scroll-hint" aria-hidden="true">
              Scroll for actions →
            </div>
            <DataTable
              label="Knowledge catalog listings"
              rows={data.listings}
              rowKey={(row) => `${row.kind}:${row.id}`}
              minWidth={850}
              emptyMessage={
                data.summary.total === 0
                  ? "No eligible catalog listings yet."
                  : "No listings match these filters."
              }
              columns={[
                { key: "name", header: "Name", cell: (row) => row.name },
                {
                  key: "kind",
                  header: "Kind",
                  cell: (row) =>
                    row.kind === "package" ? "Package" : "Service",
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (row) => <Status status={row.status} />,
                },
                {
                  key: "chunks",
                  header: (
                    <span className="knowledge-numeric">
                      Indexed / expected
                    </span>
                  ),
                  cell: (row) => (
                    <span className="knowledge-numeric">
                      {row.indexedChunks} / {row.expectedChunks}
                    </span>
                  ),
                },
                {
                  key: "date",
                  header: "Last indexed",
                  cell: (row) => date(row.lastIndexedAt),
                },
                {
                  key: "actions",
                  header: "Actions",
                  cell: (row) => (
                    <div className="knowledge-row-actions">
                      <Button
                        variant="link"
                        size="small"
                        onClick={() => setDetail(row)}
                      >
                        View content
                      </Button>
                      <Button
                        variant="link"
                        size="small"
                        onClick={() =>
                          navigateWorkspace(
                            `/app/${row.kind === "package" ? "packages" : "services"}?listing=${encodeURIComponent(row.id)}`,
                          )
                        }
                      >
                        Open listing
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination
              page={pages.page}
              hasNextPage={!!data.nextCursor}
              pending={loading}
              onPrevious={pages.previous}
              onNext={() => pages.next(data.nextCursor)}
              label="Knowledge catalog pages"
            />
          </Panel>
        </div>
      )}
      {detail && <Detail item={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
