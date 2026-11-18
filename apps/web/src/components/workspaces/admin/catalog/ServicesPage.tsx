import { usePagination } from "../../../../lib/pagination/use-pagination";
import { CatalogCard, CatalogCardActions } from "../../../catalog/CatalogCard";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Pagination,
  Dialog,
  PageHeader,
  SearchField,
  Tabs,
  useNotifications,
} from "@event-management/ui";
import { ApiError } from "../../../../lib/http/request";
import { catalogMediaSrc } from "../../../../lib/data/catalog/media";
import {
  archiveService,
  createService,
  deleteService,
  getAdminService,
  getAdminServices,
  updateService,
  type AdminService,
  type ServiceContent,
} from "../../../../lib/data/catalog/services";
import { ServiceCanvas } from "../../../catalog/CatalogContent";
import { servicePricingLabels } from "../../../../lib/utils/formatting/money";
import { CatalogDetailPreview } from "../../../catalog/CatalogDetailPreview";
import { CatalogEditor } from "../../../catalog/CatalogEditor";
import { CatalogCreateDialog } from "../../../catalog/CatalogCreateDialog";
import { useThumbnail } from "../../../../lib/utils/catalog/use-thumbnail";
import { ServiceDetailsFields } from "../../../catalog/ServiceDetailsFields";
import { validateServiceDetails } from "../../../../lib/utils/catalog/details-validation";

const empty = (): ServiceContent => ({
  name: "",
  description: "",
  hourlyRatePesos: null,
  fixedPricePesos: null,
  includedHours: null,
  sections: [{ id: crypto.randomUUID(), title: "", widgets: [] }],
  eventType: null,
});
const content = (version: AdminService): ServiceContent => ({
  name: version.name,
  description: version.description,
  hourlyRatePesos: version.hourlyRatePesos,
  fixedPricePesos: version.fixedPricePesos,
  includedHours: version.includedHours,
  sections: version.sections?.length
    ? version.sections
    : [{ id: crypto.randomUUID(), title: "", widgets: [] }],
  eventType: version.eventType ?? null,
});

function ServiceCard({
  item,
  action,
}: {
  item: ServiceContent & { imageUrl?: string | null };
  action?: ReactNode;
}) {
  const pricing = servicePricingLabels(item);
  return (
    <CatalogCard
      image={item.imageUrl ? catalogMediaSrc(item.imageUrl) : undefined}
      imageFallback="No service photo available"
      eyebrow="Event service"
      title={item.name || "Untitled service"}
      description={item.description}
      metadata={[
        { label: "Price", value: pricing.price },
        ...(pricing.excess
          ? [{ label: "Extra time", value: pricing.excess }]
          : []),
      ]}
      eventTypeBadge={item.eventType ?? null}
      action={action}
    />
  );
}

export function ServicesPage() {
  const { notify, notifyError } = useNotifications();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [counts, setCounts] = useState({ active: 0, archived: 0, filtered: 0 });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const requestId = useRef(0);
  const [rows, setRows] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Services");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<ServiceContent | null>(null);
  const [editing, setEditing] = useState<ServiceContent | null>(null);

  // Thumbnail for the create dialog. Reset each time "+ Create service" is clicked.
  const createThumbnail = useThumbnail();
  // Thumbnail for the edit editor. Seeded from imageUrl when opening an existing service.
  const editThumbnail = useThumbnail();
  const savedRef = useRef<{ id: string | null; updatedAt: string | null }>({
    id: null,
    updatedAt: null,
  });
  const savedDuringEditRef = useRef(false);
  const [preview, setPreview] = useState<AdminService | null>(null);
  const [confirm, setConfirm] = useState<{
    item: AdminService;
    action: "archive" | "delete";
  } | null>(null);
  const pagination = usePagination(`${tab}:${search}`);
  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await getAdminServices({
        cursor: pagination.cursor,
        search,
        archived: tab === "Archives" ? "archived" : "active",
      });
      if (mounted.current && current === requestId.current) {
        setRows(result.services);
        setNextCursor(result.nextCursor);
        setCounts(result.counts);
      }
    } catch (err) {
      if (!mounted.current || current !== requestId.current) return;
      setError(notifyError(err, "Something went wrong. Please try again."));
    } finally {
      if (mounted.current && current === requestId.current) setLoading(false);
    }
  }, [notifyError, pagination.cursor, search, tab]);
  useEffect(() => {
    void load();
    return () => {
      requestId.current++;
    };
  }, [load]);
  const openEdit = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const item = await getAdminService(id);
      if (!mounted.current) return;
      savedDuringEditRef.current = false;
      savedRef.current = { id, updatedAt: item.updatedAt };
      // Reset to untouched, seed preview from the existing imageUrl.
      editThumbnail.reset(item.imageUrl ? catalogMediaSrc(item.imageUrl) : null);
      setEditing(content(item));
    } catch (err) {
      if (!mounted.current) return;
      setError(notifyError(err, "Something went wrong. Please try again."));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const save = async (form: ServiceContent, thumbnailId: string | null | undefined) => {
    try {
      const { id, updatedAt } = savedRef.current;
      const result =
        id && updatedAt
          ? await updateService(id, form, updatedAt, thumbnailId)
          : await createService(form, thumbnailId);
      savedRef.current = { id: result.id, updatedAt: result.updatedAt };
      savedDuringEditRef.current = true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        throw new Error(
          `${err.message} This service changed. Close and reopen it to load the latest details.`,
        );
      throw err;
    }
  };
  const act = async () => {
    if (!confirm) return;
    setBusy(true);
    setError("");
    try {
      if (confirm.action === "archive") await archiveService(confirm.item.id);
      else await deleteService(confirm.item.id);
      notify(
        `Service ${confirm.action === "archive" ? "archived" : "deleted"}.`,
      );
      setConfirm(null);
      await load();
    } catch (err) {
      setError(notifyError(err, "Something went wrong. Please try again."));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };
  // A knowledge-dashboard link opens the exact source listing without editing it.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("listing");
    if (!id) return;
    let current = true;
    void getAdminService(id)
      .then((item) => {
        if (current) setPreview(item);
      })
      .catch((err) => {
        if (current) setError(notifyError(err, "Could not open listing."));
      });
    return () => {
      current = false;
    };
  }, [notifyError]);
  const visible = rows;
  return (
    <div className="pe-list">
      <PageHeader
        className="pe-list-head"
        title="Services"
        description="Manage your service catalog."
        actions={
          tab === "Services" && (
            <Button
              disabled={busy}
              onClick={() => {
                savedDuringEditRef.current = false;
                savedRef.current = { id: null, updatedAt: null };
                createThumbnail.reset();
                setCreating(empty());
              }}
            >
              + Create service
            </Button>
          )
        }
      />
      <Tabs
        className="pe-tabs"
        role="group"
        aria-label="Service catalog"
        active={tab}
        onChange={(value) => {
          setTab(value);
        }}
        items={[
          {
            value: "Services",
            label: "Services",
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
          onChange={(event) => {
            setSearch(event.target.value.slice(0, 200));
          }}
          placeholder="Search services"
          ariaLabel="Search services"
        />
        <span>
          {counts.filtered} {counts.filtered === 1 ? "service" : "services"}
        </span>
      </div>
      {loading && <p role="status">Loading services…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </p>
      )}
      {!loading && !error && visible.length === 0 && (
        <p>
          {search.trim()
            ? "No services found."
            : tab === "Archives"
              ? "No archived services found."
              : "No services yet. Create one to get started."}
        </p>
      )}
      <div className="pe-cards">
        {visible.map((item) => {
          return (
            <ServiceCard
              key={item.id}
              item={item}
              action={
                <CatalogCardActions
                  name={item.name || "Untitled service"}
                  disabled={busy}
                  status={{
                    tone: item.archivedAt ? "neutral" : "success",
                    label: item.archivedAt ? "Archived" : "Published",
                  }}
                  onEdit={
                    item.archivedAt ? undefined : () => void openEdit(item.id)
                  }
                  actions={[
                    { label: "Preview", onSelect: () => setPreview(item) },
                    item.archivedAt
                      ? {
                          label: "Delete",
                          onSelect: () =>
                            setConfirm({ item, action: "delete" }),
                        }
                      : {
                          label: "Archive",
                          onSelect: () =>
                            setConfirm({ item, action: "archive" }),
                        },
                  ]}
                />
              }
            />
          );
        })}
      </div>
      <Pagination
        page={pagination.page}
        hasNextPage={nextCursor !== null}
        pending={loading}
        onPrevious={pagination.previous}
        onNext={() => pagination.next(nextCursor)}
        label="Catalog pages"
      />
      {preview && (
        <CatalogDetailPreview entity="service" onClose={() => setPreview(null)}>
          <ServiceCanvas item={preview} />
        </CatalogDetailPreview>
      )}
      {creating && (
        <CatalogCreateDialog
          entity="service"
          initial={creating}
          uploading={createThumbnail.uploading}
          onClose={() => {
            createThumbnail.cancelAndCleanup();
            setCreating(null);
          }}
          onContinue={(form) => {
            setCreating(null);
            // Transfer the create thumbnail into the edit slot before opening the editor.
            editThumbnail.reset(createThumbnail.previewUrl);
            editThumbnail.mediaIdRef.current = createThumbnail.mediaIdRef.current;
            setEditing(form);
          }}
          validate={validateServiceDetails}
          renderDetails={(form, setForm) => (
            <ServiceDetailsFields
              content={form}
              onChange={setForm}
              thumbnailPreviewUrl={createThumbnail.previewUrl}
              onThumbnailChange={createThumbnail.handleChange}
              onThumbnailError={(msg) => notifyError(msg)}
              onThumbnailBusyChange={createThumbnail.setUploading}
            />
          )}
        />
      )}
      {editing && (
        <CatalogEditor
          initial={editing}
          entity="service"
          nameBadge={(c) => c.eventType ? <span>{c.eventType}</span> : null}
          onClose={() => {
            setEditing(null);
            if (savedDuringEditRef.current) void load();
          }}
          onSave={(form) => save(form, editThumbnail.mediaIdRef.current)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          validate={(form) => {
            const detailsError = validateServiceDetails(form);
            if (detailsError) return detailsError;
            if (
              !form.sections.some((section) =>
                section.widgets.some(
                  (widget) => widget.type === "photo" && widget.media,
                ),
              )
            )
              return "Add a service image before saving.";
          }}
          renderDetails={(form, setForm) => (
            <ServiceDetailsFields
              content={form}
              onChange={setForm}
              thumbnailPreviewUrl={editThumbnail.previewUrl}
              onThumbnailChange={editThumbnail.handleChange}
              onThumbnailError={(msg) => notifyError(msg)}
              onThumbnailBusyChange={editThumbnail.setUploading}
            />
          )}
          renderPreview={(form, mode) =>
            mode === "customer" ? (
              <ServiceCanvas item={form} />
            ) : (
              <div className="pe-card-preview">
                <ServiceCard
                  item={form}
                  action={
                    <CatalogCardActions
                      name={form.name}
                      status={{ tone: "success", label: "Published" }}
                    />
                  }
                />
              </div>
            )
          }
        />
      )}
      {confirm && (
        <Dialog
          title={`${confirm.action === "archive" ? "Archive" : "Delete"} service?`}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          actions={
            <>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant={confirm.action === "delete" ? "danger" : "primary"}
                pending={busy}
                onClick={() => void act()}
              >
                {busy
                  ? "Please wait…"
                  : confirm.action === "archive"
                    ? "Archive"
                    : "Delete"}
              </Button>
            </>
          }
        >
          <p>
            {confirm.action === "archive"
              ? "The service will no longer appear in the public catalog."
              : "This permanently removes the service."}
          </p>
        </Dialog>
      )}
    </div>
  );
}
