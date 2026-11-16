import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  DataTable,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  Select,
} from "@event-management/ui";
import type {
  KnowledgeListing,
  KnowledgePage as Page,
} from "@event-management/contracts/catalog-knowledge";
import { getKnowledge } from "../../../../lib/data/ai/knowledge";
import { navigateWorkspace } from "../../../../lib/navigation/workspace-navigation";
import { usePagination } from "../../../../lib/pagination/use-pagination";
import { KnowledgeDetailDrawer } from "./KnowledgeDetailDrawer";
import {
  formatKnowledgeDate,
  KnowledgeHelp,
  KnowledgeStatusBadge,
} from "./KnowledgeDisplay";
import { KnowledgeMetrics } from "./KnowledgeMetrics";
import { KnowledgeSearch } from "./KnowledgeSearch";
import "../../../../styles/ai/knowledge.css";

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
            <KnowledgeHelp text="The assistant is not connected to catalog search." />
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
          <KnowledgeMetrics
            summary={data.summary}
            status={status}
            onStatusChange={setStatus}
          />
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
                  cell: (row) => <KnowledgeStatusBadge status={row.status} />,
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
                  cell: (row) => formatKnowledgeDate(row.lastIndexedAt),
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
      {detail && (
        <KnowledgeDetailDrawer item={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
