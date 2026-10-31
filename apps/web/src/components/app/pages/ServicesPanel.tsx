import { useCallback, useEffect, useState } from "react"
import { Badge, Button, Dialog, FormField, Tabs } from "@event-management/ui"
import { ApiError, archiveService, createService, deleteService, getAdminService, getAdminServices, publishService, serviceImageSrc, updateServiceDraft } from "../../../lib/api"
import type { AdminService, ServiceContent, ServiceVersion } from "../../../lib/api"
import { TagInput } from "../TagInput"

const empty: ServiceContent = { name: "", categories: [], description: "", imageUrl: null }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again."
function content(version: ServiceVersion): ServiceContent {
  return { name: version.name, categories: [...version.categories], description: version.description, imageUrl: version.imageUrl }
}

export function ServicesPanel() {
  const [rows, setRows] = useState<AdminService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState("Services")
  const [editing, setEditing] = useState<{ id: string | null; updatedAt: string | null; form: ServiceContent } | null>(null)
  const [formError, setFormError] = useState("")
  const [confirm, setConfirm] = useState<{ item: AdminService; action: "publish" | "archive" | "delete" } | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { setRows((await getAdminServices()).services) } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const openEdit = async (id: string) => {
    setBusy(true); setError("")
    try {
      const item = await getAdminService(id), version = item.draft || item.published
      if (!version) throw new Error("This service has no editable details.")
      setFormError(""); setEditing({ id, updatedAt: version.updatedAt, form: content(version) })
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  const save = async () => {
    if (!editing) return
    setBusy(true); setFormError("")
    try {
      const imageUrl = editing.form.imageUrl?.trim() || null
      if (imageUrl) {
        let external = false
        try { external = new URL(imageUrl).protocol === "https:" } catch { /* Invalid URL */ }
        if (imageUrl.length > 2048 || !external) throw new Error("Enter a valid HTTPS image URL.")
      }
      const form = { ...editing.form, categories: editing.form.categories.map(value => value.trim()).filter(Boolean), imageUrl }
      if (editing.id && editing.updatedAt) await updateServiceDraft(editing.id, form, editing.updatedAt)
      else await createService(form)
      setEditing(null); setNotice("Service draft saved."); await load()
    } catch (err) {
      const detail = err instanceof ApiError && err.status === 409 ? `${errorMessage(err)} This service changed. Close and reopen it to load the latest details.` : errorMessage(err)
      setFormError(detail)
    } finally { setBusy(false) }
  }
  const act = async () => {
    if (!confirm) return
    setBusy(true); setError("")
    try {
      if (confirm.action === "publish") {
        if (!confirm.item.draft) throw new Error("There is no draft to publish.")
        await publishService(confirm.item.id, confirm.item.draft.updatedAt)
      } else if (confirm.action === "archive") await archiveService(confirm.item.id)
      else await deleteService(confirm.item.id)
      setNotice(`Service ${confirm.action === "publish" ? "published" : confirm.action === "archive" ? "archived" : "deleted"}.`); setConfirm(null); await load()
    } catch (err) { setError(errorMessage(err)); setConfirm(null) } finally { setBusy(false) }
  }
  const field = <K extends keyof ServiceContent>(key: K, value: ServiceContent[K]) => setEditing(current => current ? { ...current, form: { ...current.form, [key]: value } } : current)
  const visible = rows.filter(item => tab === "Archives" ? !!item.archivedAt : !item.archivedAt)
  return <div className="service-panel">
    <div className="service-panel-heading"><div><h1>Services</h1><p>Create services to include in packages or offer as add-ons.</p></div>{tab === "Services" && <Button disabled={busy} onClick={() => { setFormError(""); setEditing({ id: null, updatedAt: null, form: { ...empty, categories: [] } }) }}>Create service</Button>}</div>
    <Tabs className="package-tabs" active={tab} onChange={setTab} items={[{ value: "Services", label: "Services", count: rows.filter(item => !item.archivedAt).length }, { value: "Archives", label: "Archives", count: rows.filter(item => item.archivedAt).length }]} />
    {loading && <p role="status">Loading services…</p>}{error && <p role="alert">{error} <button onClick={() => void load()}>Try again</button></p>}{notice && <p role="status">{notice}</p>}
    {!loading && !error && visible.length === 0 && <p>{tab === "Archives" ? "No archived services found." : "No services yet. Create a draft to get started."}</p>}
    <div className="service-grid">{visible.map(item => { const version = item.draft || item.published; if (!version) return null; return <article className="admin-package-card" key={item.id}>
      <div className="admin-package-image service-card-image">{version.imageUrl && <img src={serviceImageSrc(version.imageUrl)} alt="" />}<Badge tone={item.archivedAt ? "neutral" : item.draft ? "warning" : "success"}>{item.archivedAt ? "Archived" : item.draft ? item.published ? "Draft changes" : "Draft" : "Published"}</Badge></div>
      <div className="admin-package-body service-card-body"><span className="package-kind">{version.categories.join(", ") || "Uncategorized"}</span><h3 className="card-title">{version.name || "Untitled service"}</h3><p>{version.description || "No description yet."}</p>
      <div className="service-card-actions">{!item.archivedAt && <Button disabled={busy} onClick={() => void openEdit(item.id)}>Edit draft</Button>}{item.draft && !item.archivedAt && <Button disabled={busy} onClick={() => setConfirm({ item, action: "publish" })}>Publish draft</Button>}{item.published && !item.archivedAt && <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ item, action: "archive" })}>Archive</Button>}{!item.published && !item.archivedAt && <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ item, action: "delete" })}>Delete</Button>}</div></div>
    </article> })}</div>
    {editing && <Dialog title={editing.id ? "Edit service draft" : "Create service"} eyebrow="Service catalog" onClose={() => { if (!busy && window.confirm("Discard unsaved changes?")) setEditing(null) }} actions={<><Button variant="secondary" disabled={busy} onClick={() => { if (window.confirm("Discard unsaved changes?")) setEditing(null) }}>Cancel</Button><Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save draft"}</Button></>}>
      {formError && <p role="alert">{formError}</p>}
      <div className="form-grid"><FormField className="full" label="Service name *"><input value={editing.form.name} onChange={e => field("name", e.target.value)} /></FormField><TagInput label="Categories" required values={editing.form.categories} onChange={value => field("categories", value)} /><FormField className="full" label="Description *"><textarea value={editing.form.description} onChange={e => field("description", e.target.value)} /></FormField><FormField className="full" label="Image URL"><input type="url" placeholder="https://..." value={editing.form.imageUrl || ""} onChange={e => field("imageUrl", e.target.value)} /></FormField>{editing.form.imageUrl && <div className="full package-image-preview"><img src={serviceImageSrc(editing.form.imageUrl)} alt="Service preview" /><button type="button" onClick={() => field("imageUrl", null)}>Remove image</button></div>}</div>
    </Dialog>}
    {confirm && <Dialog title={`${confirm.action === "publish" ? "Publish" : confirm.action === "archive" ? "Archive" : "Delete"} service?`} onClose={() => { if (!busy) setConfirm(null) }} actions={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button><Button disabled={busy} onClick={() => void act()}>{busy ? "Please wait…" : confirm.action === "publish" ? "Publish" : confirm.action === "archive" ? "Archive" : "Delete"}</Button></>}><p>{confirm.action === "publish" ? "The server will validate and publish this draft. Existing packages keep their selected service details." : confirm.action === "archive" ? "The service will no longer be available for new selections. Services used by published packages cannot be archived." : "This permanently removes the never-published draft."}</p></Dialog>}
  </div>
}
