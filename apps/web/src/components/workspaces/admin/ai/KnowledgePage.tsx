import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  DataTable,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  Select,
  useNotifications,
} from "@event-management/ui";
import type {
  KnowledgeListing,
  KnowledgePage as Page,
} from "@event-management/contracts/catalog-knowledge";
import {
  getKnowledge,
  indexPendingKnowledge,
} from "../../../../lib/data/ai/knowledge";
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
  const { notify, notifyError } = useNotifications();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [detail, setDetail] = useState<KnowledgeListing | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexMessage, setIndexMessage] = useState("");
  const [indexError, setIndexError] = useState(false);
  const indexRun = useRef<{ stopped: boolean } | null>(null);
  const seq = useRef(0);
  const pages = usePagination(`${search}:${kind}:${status}`);

  const load = useCallback(() => setRetry((n) => n + 1), []);

  useEffect(
    () => () => {
      if (indexRun.current) indexRun.current.stopped = true;
    },
    [],
  );
  async function indexPending() {
    if (indexRun.current) return;

    const run = { stopped: false };
    indexRun.current = run;
    setIndexing(true);
    setIndexError(false);
    setIndexMessage("Indexing pending knowledge across the catalog…");
    setDetail(null);
    let embedded = 0;
    let failed = 0;
    let cursor: string | undefined;

    try {
      do {
        const result = await indexPendingKnowledge(cursor);

        if (run.stopped) return;

        embedded += result.embedded;
        failed += result.failed;
        setIndexMessage(
          `Indexing… ${embedded} chunks indexed; ${failed} failed.`,
        );
        load();
        cursor = result.nextCursor ?? undefined;
      } while (cursor);

      const message = failed
        ? `${embedded} chunks indexed; ${failed} failed. Select Index pending to retry. Failed chunks remain unavailable to semantic search.`
        : embedded
          ? `${embedded} chunks indexed for semantic search.`
          : "Indexing pass finished. Any listings still needing attention can be retried.";
      setIndexMessage(message);
      setIndexError(failed > 0);
      notify(message, failed ? "info" : "success");
    } catch (cause) {
      if (!run.stopped) {
        setIndexError(true);
        const message = notifyError(
          cause,
          "Unable to index pending knowledge. Select Index pending to retry; completed chunks are saved.",
        );
        setIndexMessage(
          `${embedded} chunks indexed before stopping. Select Index pending to retry. ${message}`,
        );
      }
    } finally {
      if (indexRun.current === run) indexRun.current = null;

      if (!run.stopped) {
        setIndexing(false);
        pages.reset();
        load();
      }
    }
  }
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
            <Button
              onClick={() => void indexPending()}
              pending={indexing}
              disabled={loading || !data || data.summary.attention === 0}
            >
              {indexing ? "Indexing pending…" : "Index pending"}
            </Button>
            <KnowledgeHelp text="Index pending and outdated text and photos across all eligible catalog listings using the configured embedding model. Keep this page open until finished; completed chunks are saved and failures can be retried." />
            <Button
              variant="secondary"
              onClick={load}
              pending={loading}
              disabled={indexing}
            >
              Refresh
            </Button>
          </div>
        }
      />
      {indexMessage && (
        <p
          role={indexError ? "alert" : "status"}
          className={indexError ? "knowledge-error" : undefined}
        >
          {indexMessage}
        </p>
      )}
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
