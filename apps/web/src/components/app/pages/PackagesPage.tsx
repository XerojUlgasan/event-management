import {
  Button,
  PageHeader,
  SearchField,
  Tabs,
} from "@event-management/ui";
import { PackageCard, PackageEditor } from "./PackageEditor";
import { getAdminServices } from "../../../lib/data/services";
import { CatalogCardActions } from "./CatalogCard";
import { useCallback, useEffect, useState } from "react";
import {
  archivePackage,
  deletePackage,
  getAdminPackages,
  type AdminPackage,
} from "../../../lib/data/packages";
import { PackagePreview } from "../PackagePreview";
import "../../../styles/package-editor.css";

const message = (e: unknown) => e instanceof Error ? e.message : "Something went wrong.";
export function PackagesPage() {
  const [rows, setRows] = useState<AdminPackage[]>([]),
    [serviceOptions, setServiceOptions] = useState<import("../../../lib/data/services").AdminService[]>([]),
    [search, setSearch] = useState(""),
    [archived, setArchived] = useState(false),
    [editing, setEditing] = useState<AdminPackage | "new" | null>(null),
    [preview, setPreview] = useState<AdminPackage | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [packages, services] = await Promise.all([getAdminPackages(), getAdminServices()]);
      setRows(packages.packages); setServiceOptions(services.services);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const visible = rows.filter(
    (p) =>
      !!p.archivedAt === archived &&
      `${p.name} ${p.description}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
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
      await load();
    } catch (e) {
      setError(message(e));
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
        onChange={(value) => setArchived(value === "Archives")}
        items={[
          {
            value: "Packages",
            label: "Packages",
            count: rows.filter((row) => !row.archivedAt).length,
          },
          {
            value: "Archives",
            label: "Archives",
            count: rows.filter((row) => row.archivedAt).length,
          },
        ]}
      />
      <div className="pe-list-tools">
        <SearchField
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search packages"
          ariaLabel="Search packages"
        />
        <span>
          {visible.length} {visible.length === 1 ? "package" : "packages"}
        </span>
      </div>
      {loading && <p role="status">Loading packages…</p>}
      {error && <p role="alert">{error}</p>}
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
      {editing && (
        <PackageEditor
          serviceOptions={serviceOptions}
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
