import { CatalogCard, CatalogCardActions } from "./CatalogCard"
import type { ReactNode } from "react"
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button, Dialog, FormField } from "@event-management/ui"
import { ApiError, archiveService, catalogMediaSrc, createService, deleteService, getAdminService, getAdminServices, updateService } from "../../../lib/api"
import type { AdminService, ServiceContent } from "../../../lib/api"
import { CatalogDetailPreview, ServiceCanvas, serviceRateLabel as rateLabel } from "../CatalogPreview"
import { CatalogEditor } from "./CatalogEditor"

const empty = (): ServiceContent => ({ name: "", description: "", hourlyRatePesos: null, sections: [{ id: crypto.randomUUID(), title: "", widgets: [] }] })
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again."
const content = (version: AdminService): ServiceContent => ({ name: version.name, description: version.description, hourlyRatePesos: version.hourlyRatePesos, sections: version.sections?.length ? version.sections : [{ id: crypto.randomUUID(), title: "", widgets: [] }] })
const cover = (version: ServiceContent) => {
  const photo = version.sections?.flatMap(section => section.widgets).find(widget => widget.type === "photo" && widget.media?.url)
  return photo?.media?.url ? catalogMediaSrc(photo.media.url) : undefined
}

function ServiceCard({ item, action }: { item: ServiceContent; action?: ReactNode }) {
  return <CatalogCard image={cover(item)} imageFallback="No service photo available" eyebrow="Event service" title={item.name || "Untitled service"} description={item.description} metadata={[{ label: "Hourly rate", value: rateLabel(item.hourlyRatePesos) }]} action={action} />
}

export function ServicesPanel() {
  const [rows, setRows] = useState<AdminService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState("Services")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<ServiceContent | null>(null)
  const savedRef = useRef<{ id: string | null; updatedAt: string | null }>({ id: null, updatedAt: null })
  const savedDuringEditRef = useRef(false)
  const [preview, setPreview] = useState<AdminService | null>(null)
  const [confirm, setConfirm] = useState<{ item: AdminService; action: "archive" | "delete" } | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { setRows((await getAdminServices()).services) } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const openEdit = async (id: string) => {
    setBusy(true); setError("")
    try {
      const item = await getAdminService(id)
      savedDuringEditRef.current = false; savedRef.current = { id, updatedAt: item.updatedAt }
      setEditing(content(item))
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  const save = async (form: ServiceContent) => {
    try {
      const { id, updatedAt } = savedRef.current
      const result = id && updatedAt ? await updateService(id, form, updatedAt) : await createService(form)
      savedRef.current = { id: result.id, updatedAt: result.updatedAt }
      savedDuringEditRef.current = true
    } catch (err) {
      throw new Error(err instanceof ApiError && err.status === 409 ? `${errorMessage(err)} This service changed. Close and reopen it to load the latest details.` : errorMessage(err))
    }
  }
  const act = async () => {
    if (!confirm) return
    setBusy(true); setError("")
    try {
      if (confirm.action === "archive") await archiveService(confirm.item.id)
      else await deleteService(confirm.item.id)
      setNotice(`Service ${confirm.action === "archive" ? "archived" : "deleted"}.`); setConfirm(null); await load()
    } catch (err) { setError(errorMessage(err)); setConfirm(null) } finally { setBusy(false) }
  }
  const visible = rows.filter(item => {
    if (tab === "Archives" ? !item.archivedAt : !!item.archivedAt) return false
    return `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase().trim())
  })
  return <div className="pe-list">
    <div className="pe-list-head"><div><h1>Services</h1><p>Manage your service catalog.</p></div>{tab === "Services" && <button className="pe-primary" disabled={busy} onClick={() => { savedDuringEditRef.current = false; savedRef.current = { id: null, updatedAt: null }; setEditing(empty()) }}>+ Create service</button>}</div>
    <div className="pe-tabs" role="tablist" aria-label="Service catalog"><button role="tab" aria-selected={tab === "Services"} onClick={() => setTab("Services")}>Services <span>{rows.filter(item => !item.archivedAt).length}</span></button><button role="tab" aria-selected={tab === "Archives"} onClick={() => setTab("Archives")}>Archives <span>{rows.filter(item => item.archivedAt).length}</span></button></div>
    <div className="pe-list-tools"><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search services" aria-label="Search services" /><span>{visible.length} {visible.length === 1 ? "service" : "services"}</span></div>
    {loading && <p role="status">Loading services…</p>}{error && <p role="alert">{error} <button onClick={() => void load()}>Try again</button></p>}{notice && <p role="status">{notice}</p>}
    {!loading && !error && visible.length === 0 && <p>{search.trim() ? "No services found." : tab === "Archives" ? "No archived services found." : "No services yet. Create one to get started."}</p>}
    <div className="pe-cards">{visible.map(item => {
      return <ServiceCard key={item.id} item={item} action={<CatalogCardActions name={item.name || "Untitled service"} disabled={busy} status={{ tone: item.archivedAt ? "neutral" : "success", label: item.archivedAt ? "Archived" : "Published" }} onEdit={item.archivedAt ? undefined : () => void openEdit(item.id)} actions={[
        { label: "Preview", onSelect: () => setPreview(item) },
        item.archivedAt ? { label: "Delete", onSelect: () => setConfirm({ item, action: "delete" }) } : { label: "Archive", onSelect: () => setConfirm({ item, action: "archive" }) },
      ]} />} />
    })}</div>
    {preview && <CatalogDetailPreview entity="service" onClose={() => setPreview(null)}><ServiceCanvas item={preview} /></CatalogDetailPreview>}
    {editing && <CatalogEditor initial={editing} entity="service" onClose={() => { setEditing(null); if (savedDuringEditRef.current) void load() }} onSave={save} onSaved={() => { setEditing(null); setNotice("Service saved."); void load() }} validate={form => {
      if (form.hourlyRatePesos != null && (!Number.isInteger(form.hourlyRatePesos) || form.hourlyRatePesos <= 0 || form.hourlyRatePesos > 2147483647)) return "Hourly rate must be a whole number greater than zero."
      if (!form.name.trim()) return "Enter a service name before saving."
      if (!form.description.trim()) return "Enter a description before saving."
      if (form.hourlyRatePesos == null) return "Enter an hourly rate before saving."
      if (!form.sections.some(section => section.widgets.some(widget => widget.type === "photo" && widget.media))) return "Add a service image before saving."
    }} renderDetails={(form, setForm) => <div className="form-grid"><FormField className="full" label="Catalog description *"><textarea maxLength={MAX_CATALOG_TEXT_LENGTH} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FormField><FormField className="full" label="Hourly rate (PHP)"><input type="number" min="1" step="1" value={form.hourlyRatePesos ?? ""} onChange={e => setForm({ ...form, hourlyRatePesos: e.target.value === "" ? null : Number(e.target.value) })} /><small>Enter whole pesos. A rate is required.</small></FormField></div>} renderPreview={(form, mode) => mode === "customer" ? <ServiceCanvas item={form} /> : <div className="pe-card-preview"><ServiceCard item={form} action={<CatalogCardActions name={form.name} status={{ tone: "success", label: "Published" }} />} /></div>} />}
    {confirm && <Dialog title={`${confirm.action === "archive" ? "Archive" : "Delete"} service?`} onClose={() => { if (!busy) setConfirm(null) }} actions={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button><Button disabled={busy} onClick={() => void act()}>{busy ? "Please wait…" : confirm.action === "archive" ? "Archive" : "Delete"}</Button></>}><p>{confirm.action === "archive" ? "The service will no longer appear in the public catalog." : "This permanently removes the service."}</p></Dialog>}

  </div>
}
