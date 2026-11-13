import { usePagination } from "../../../lib/use-pagination";
import {
  Button,
  Pagination,
  PageHeader,
  SearchField,
  Tabs,
  useNotifications,
} from "@event-management/ui";
import { PackageCard, PackageEditor } from "./PackageEditor";
import { CatalogCardActions } from "./CatalogCard";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  archivePackage,
  deletePackage,
  getAdminPackages,
  type AdminPackage,
} from "../../../lib/data/packages";
import { PackagePreview } from "../PackagePreview";
import "../../../styles/package-editor.css";

export function PackagesPage() {
  const { notify, notifyError } = useNotifications();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [counts, setCounts] = useState({ active: 0, archived: 0, filtered: 0 });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const requestId = useRef(0);
  const [rows, setRows] = useState<AdminPackage[]>([]),
    [search, setSearch] = useState(""),
    [archived, setArchived] = useState(false),
    [editing, setEditing] = useState<AdminPackage | "new" | null>(null),
    [preview, setPreview] = useState<AdminPackage | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const pagination = usePagination(`${archived}:${search}`);
  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const packages = await getAdminPackages({ cursor: pagination.cursor, search, archived: archived ? "archived" : "active" });
      if (!mounted.current || current !== requestId.current) return;
      setNextCursor(packages.nextCursor); setCounts(packages.counts);
      setRows(packages.packages);
    } catch (e) {
      if (!mounted.current || current !== requestId.current) return;
      setError(notifyError(e, "Something went wrong."));
    } finally {
      if (mounted.current && current === requestId.current) setLoading(false);
    }
  }, [notifyError, pagination.cursor, search, archived]);
  useEffect(() => {
    void load();
    return () => { requestId.current++; };
  }, [load]);
  const visible = rows;
  const act = async (item: AdminPackage, action: "archive" | "delete") => {
    if (
      !window.confirm(
        `${action === "archive" ? "Archive" : "Delete"} ${item.name}?`,
      )
    )
      return;
    try {
      if (action === "archive") await archivePackage(item.id);
      else await deletePackage(item.id);
      notify(`Package ${action === "archive" ? "archived" : "deleted"}.`);
      await load();
    } catch (e) {
      setError(notifyError(e, "Something went wrong."));
    }
  };
  return (
    <div className="pe-list">
      <PageHeader
        className="pe-list-head"
        title="Packages"
        description="Manage your package catalog."
        actions={
          <Button onClick={() => setEditing("new")}>+ Create package</Button>
        }
      />
      <Tabs
        className="pe-tabs"
        role="group"
        aria-label="Package catalog"
        active={archived ? "Archives" : "Packages"}
        onChange={(value) => { setArchived(value === "Archives"); }}
        items={[
          {
            value: "Packages",
            label: "Packages",
            count: counts.active,

          },
          {
            value: "Archives",
            label: "Archives",
            count: counts.archived,

          },
        ]}
      />
      <div className="pe-list-tools">
        <SearchField
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value.slice(0, 200)); }}
          placeholder="Search packages"
          ariaLabel="Search packages"
        />
        <span>
          {counts.filtered} {counts.filtered === 1 ? "package" : "packages"}
        </span>
      </div>
      {loading && <p role="status">Loading packages…</p>}
      {error && <p role="alert">{error} <Button variant="secondary" onClick={() => void load()}>Try again</Button></p>}
      <div className="pe-cards">
        {visible.map((item) => (
          <PackageCard
            key={item.id}
            item={item}
            action={
              <CatalogCardActions
                name={item.name}
                status={{
                  label: archived ? "Archived" : "Published",
                  tone: archived ? "neutral" : "success",
                }}
                actions={[
                  { label: "Preview", onSelect: () => setPreview(item) },
                  {
                    label: archived ? "Delete" : "Archive",
                    onSelect: () =>
                      void act(item, archived ? "delete" : "archive"),
                  },
                ]}
                onEdit={archived ? undefined : () => setEditing(item)}
              />
            }
          />
        ))}
      </div>
      {!loading && !visible.length && <p>No packages found.</p>}
      <Pagination page={pagination.page} hasNextPage={nextCursor !== null} pending={loading} onPrevious={pagination.previous} onNext={() => pagination.next(nextCursor)} label="Catalog pages" />
      {editing && (
        <PackageEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {preview && (
        <PackagePreview
          item={preview}
          allowBooking={false}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
