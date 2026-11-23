import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  PageHeader,
  SearchField,
  Tabs,
  Pagination,
  useNotifications,
} from "@event-management/ui";
import { CatalogCard, CatalogCardActions } from "../../../catalog/CatalogCard";
import { ShowcaseEditor } from "./ShowcaseEditor";
import {
  getAdminShowcases,
  publishShowcase,
  unpublishShowcase,
  deleteShowcase,
  showcaseMediaSrc,
} from "../../../../lib/data/showcases/showcases";
import type { ShowcaseRecord } from "@event-management/contracts/showcase";
import { usePagination } from "../../../../lib/pagination/use-pagination";
import "../../../../styles/catalog/package-editor.css";
import "../../../../styles/showcase-admin.css";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ShowcasesPage() {
  const { notify, notifyError } = useNotifications();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [rows, setRows] = useState<ShowcaseRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"published" | "drafts">("published");
  const [editing, setEditing] = useState<ShowcaseRecord | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const pagination = usePagination(tab);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const page = await getAdminShowcases(pagination.cursor);
      if (!mounted.current || current !== requestId.current) return;
      setRows(page.showcases);
      setNextCursor(page.nextCursor);
    } catch (e) {
      if (!mounted.current || current !== requestId.current) return;
      setError(notifyError(e, "Could not load showcases."));
    } finally {
      if (mounted.current && current === requestId.current) setLoading(false);
    }
  }, [notifyError, pagination.cursor]);

  useEffect(() => {
    void load();
    return () => { requestId.current++; };
  }, [load]);

  // Filter client-side by tab and search.
  const published = rows.filter((r) => r.publishedAt !== null);
  const drafts = rows.filter((r) => r.publishedAt === null);
  const active = tab === "published" ? published : drafts;
  const filtered = search.trim()
    ? active.filter(
        (r) =>
          r.title.toLowerCase().includes(search.toLowerCase()) ||
          r.description.toLowerCase().includes(search.toLowerCase()),
      )
    : active;

  async function handlePublish(id: string) {
    try {
      const updated = await publishShowcase(id);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      notify("Showcase published.");
    } catch (e) {
      setError(notifyError(e, "Could not publish showcase."));
    }
  }

  async function handleUnpublish(id: string) {
    try {
      const updated = await unpublishShowcase(id);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      notify("Showcase unpublished. It's now a draft.");
    } catch (e) {
      setError(notifyError(e, "Could not unpublish showcase."));
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    const item = rows.find((r) => r.id === deletingId);
    try {
      await deleteShowcase(deletingId);
      setRows((prev) => prev.filter((r) => r.id !== deletingId));
      setDeletingId(null);
      notify(`"${item?.title}" deleted.`);
    } catch (e) {
      setDeletingId(null);
      setError(notifyError(e, "Could not delete showcase."));
    }
  }

  return (
    <div className="pe-list">
      <PageHeader
        className="pe-list-head"
        title="Showcases"
        description="Manage past-event showcase records."
        actions={
          <Button onClick={() => setEditing("new")}>+ Create showcase</Button>
        }
      />

      <Tabs
        className="pe-tabs"
        role="group"
        aria-label="Showcase records"
        active={tab === "published" ? "Published" : "Drafts"}
        onChange={(value) =>
          setTab(value === "Published" ? "published" : "drafts")
        }
        items={[
          { value: "Published", label: "Published", count: published.length },
          { value: "Drafts", label: "Drafts", count: drafts.length },
        ]}
      />

      <div className="pe-list-tools">
        <SearchField
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value.slice(0, 200))}
          placeholder="Search showcases"
          ariaLabel="Search showcases"
        />
        <span>
          {filtered.length}{" "}
          {filtered.length === 1 ? "showcase" : "showcases"}
        </span>
      </div>

      {loading && <p role="status">Loading showcases…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </p>
      )}

      {!loading && filtered.length === 0 && !error && (
        <p className="pe-empty">
          {search
            ? "No showcases match your search."
            : tab === "published"
              ? "No published showcases yet."
              : "No drafts yet."}
        </p>
      )}

      <div className="pe-cards">
        {filtered.map((item) => (
          <CatalogCard
            key={item.id}
            image={showcaseMediaSrc(item.coverUrl)}
            eyebrow="Past event"
            title={item.title}
            description={item.description}
            metadata={[
              {
                label: "Media",
                value: `${item.media.length} item${item.media.length === 1 ? "" : "s"}`,
              },
              {
                label: item.publishedAt ? "Published" : "Created",
                value: formatDate(item.publishedAt ?? item.createdAt),
              },
            ]}
            action={
              <CatalogCardActions
                name={item.title}
                status={
                  item.publishedAt
                    ? { label: "Published", tone: "success" }
                    : { label: "Draft", tone: "neutral" }
                }
                actions={[
                  item.publishedAt
                    ? { label: "Unpublish", onSelect: () => void handleUnpublish(item.id) }
                    : { label: "Publish", onSelect: () => void handlePublish(item.id) },
                  { label: "Delete", onSelect: () => setDeletingId(item.id) },
                ]}
                onEdit={() => setEditing(item)}
              />
            }
          />
        ))}
      </div>

      <Pagination
        page={pagination.page}
        hasNextPage={nextCursor !== null}
        pending={loading}
        onPrevious={pagination.previous}
        onNext={() => pagination.next(nextCursor)}
        label="Showcase pages"
      />

      {editing && (
        <ShowcaseEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setRows((prev) => {
              const idx = prev.findIndex((r) => r.id === saved.id);
              return idx === -1 ? [saved, ...prev] : prev.map((r) => (r.id === saved.id ? saved : r));
            });
            // A new record is always a draft — switch to that tab so it's visible.
            if (editing === "new") setTab("drafts");
            setEditing(null);
          }}
        />
      )}

      {deletingId && (
        <div className="showcase-delete-backdrop" role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div className="showcase-delete-dialog">
            <h3>Delete showcase?</h3>
            <p>
              This permanently removes the showcase and cannot be undone.
              Unpublishing keeps the content saved.
            </p>
            <div className="showcase-delete-actions">
              <Button variant="secondary" onClick={() => setDeletingId(null)}>Cancel</Button>
              <Button className="button-danger" onClick={() => void confirmDelete()}>
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
