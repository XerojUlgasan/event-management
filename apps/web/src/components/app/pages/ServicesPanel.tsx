import { CatalogCard, CatalogCardActions } from "./CatalogCard";
import type { ReactNode } from "react";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  FormField,
  Input,
  PageHeader,
  SearchField,
  Tabs,
  Textarea,
  useNotifications,
} from "@event-management/ui";
import { ApiError } from "../../../lib/http";
import { catalogMediaSrc } from "../../../lib/data/catalog-media";
import {
  archiveService,
  createService,
  deleteService,
  getAdminService,
  getAdminServices,
  updateService,
  type AdminService,
  type ServiceContent,
} from "../../../lib/data/services";
import {
  CatalogDetailPreview,
  ServiceCanvas,
  serviceRateLabel as rateLabel,
} from "../CatalogPreview";
import { CatalogEditor } from "./CatalogEditor";

const empty = (): ServiceContent => ({
  name: "",
  description: "",
  hourlyRatePesos: null,
  sections: [{ id: crypto.randomUUID(), title: "", widgets: [] }],
});
const content = (version: AdminService): ServiceContent => ({
  name: version.name,
  description: version.description,
  hourlyRatePesos: version.hourlyRatePesos,
  sections: version.sections?.length
    ? version.sections
    : [{ id: crypto.randomUUID(), title: "", widgets: [] }],
});
const cover = (version: ServiceContent) => {
  const photo = version.sections
    ?.flatMap((section) => section.widgets)
    .find((widget) => widget.type === "photo" && widget.media?.url);
  return photo?.media?.url ? catalogMediaSrc(photo.media.url) : undefined;
};

function ServiceCard({
  item,
  action,
}: {
  item: ServiceContent;
  action?: ReactNode;
}) {
  return (
    <CatalogCard
      image={cover(item)}
      imageFallback="No service photo available"
      eyebrow="Event service"
      title={item.name || "Untitled service"}
      description={item.description}
      metadata={[
        { label: "Hourly rate", value: rateLabel(item.hourlyRatePesos) },
      ]}
      action={action}
    />
  );
}

export function ServicesPanel() {
  const { notify, notifyError } = useNotifications();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [rows, setRows] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Services");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ServiceContent | null>(null);
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
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminServices();
      if (mounted.current) setRows(result.services);
    } catch (err) {
      if (!mounted.current) return;
      setError(notifyError(err, "Something went wrong. Please try again."));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [notifyError]);
  useEffect(() => {
    void load();
  }, [load]);
  const openEdit = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const item = await getAdminService(id);
      if (!mounted.current) return;
      savedDuringEditRef.current = false;
      savedRef.current = { id, updatedAt: item.updatedAt };
      setEditing(content(item));
    } catch (err) {
      if (!mounted.current) return;
      setError(notifyError(err, "Something went wrong. Please try again."));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const save = async (form: ServiceContent) => {
    try {
      const { id, updatedAt } = savedRef.current;
      const result =
        id && updatedAt
          ? await updateService(id, form, updatedAt)
          : await createService(form);
      savedRef.current = { id: result.id, updatedAt: result.updatedAt };
      savedDuringEditRef.current = true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        throw new Error(`${err.message} This service changed. Close and reopen it to load the latest details.`);
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
      notify(`Service ${confirm.action === "archive" ? "archived" : "deleted"}.`);
      setConfirm(null);
      await load();
    } catch (err) {
      setError(notifyError(err, "Something went wrong. Please try again."));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };
  const visible = rows.filter((item) => {
    if (tab === "Archives" ? !item.archivedAt : !!item.archivedAt) return false;
    return `${item.name} ${item.description}`
      .toLowerCase()
      .includes(search.toLowerCase().trim());
  });
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
                setEditing(empty());
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
        onChange={setTab}
        items={[
          {
            value: "Services",
            label: "Services",
            count: rows.filter((item) => !item.archivedAt).length,
          },
          {
            value: "Archives",
            label: "Archives",
            count: rows.filter((item) => item.archivedAt).length,
          },
        ]}
      />
      <div className="pe-list-tools">
        <SearchField
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search services"
          ariaLabel="Search services"
        />
        <span>
          {visible.length} {visible.length === 1 ? "service" : "services"}
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
      {preview && (
        <CatalogDetailPreview entity="service" onClose={() => setPreview(null)}>
          <ServiceCanvas item={preview} />
        </CatalogDetailPreview>
      )}
      {editing && (
        <CatalogEditor
          initial={editing}
          entity="service"
          onClose={() => {
            setEditing(null);
            if (savedDuringEditRef.current) void load();
          }}
          onSave={save}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          validate={(form) => {
            if (
              form.hourlyRatePesos != null &&
              (!Number.isInteger(form.hourlyRatePesos) ||
                form.hourlyRatePesos <= 0 ||
                form.hourlyRatePesos > 2147483647)
            )
              return "Hourly rate must be a whole number greater than zero.";
            if (!form.name.trim()) return "Enter a service name before saving.";
            if (!form.description.trim())
              return "Enter a description before saving.";
            if (form.hourlyRatePesos == null)
              return "Enter an hourly rate before saving.";
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
            <div className="form-grid">
              <FormField className="full" label="Catalog description *">
                <Textarea
                  maxLength={MAX_CATALOG_TEXT_LENGTH}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </FormField>
              <FormField className="full" label="Hourly rate (PHP)">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.hourlyRatePesos ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      hourlyRatePesos:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
                <small>Enter whole pesos. A rate is required.</small>
              </FormField>
            </div>
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
              <Button variant={confirm.action === "delete" ? "danger" : "primary"} pending={busy} onClick={() => void act()}>
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
