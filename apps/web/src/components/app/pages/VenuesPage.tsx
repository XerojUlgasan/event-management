import { useCallback, useEffect, useRef, useState } from "react"
import { Badge, Button, Dialog, FormField, Tabs } from "@event-management/ui"
import { ApiError, archiveVenue, createVenue, deleteUnreferencedVenueImage, deleteVenue, getAdminVenue, getAdminVenues, publishVenue, updateVenueDraft, uploadVenueImage, venueImageSrc } from "../../../lib/api"
import type { AdminVenue, VenueContent, VenueVersion } from "../../../lib/api"
import { TagInput } from "../TagInput"

type Photo = { key: string; url: string; file?: File }
type Form = Omit<VenueContent, "capacityMin" | "capacityMax" | "imageUrls"> & { capacityMin: string; capacityMax: string; photos: Photo[] }
const empty = (): Form => ({ name: "", location: "", description: "", categories: [], capacityMin: "", capacityMax: "", photos: [] })
const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again."
function formFrom(version: VenueVersion): Form {
  return { name: version.name, location: version.location, description: version.description, categories: [...version.categories], capacityMin: version.capacityMin == null ? "" : String(version.capacityMin), capacityMax: version.capacityMax == null ? "" : String(version.capacityMax), photos: version.imageUrls.map(url => ({ key: url, url })) }
}

export function VenuesPage() {
  const [rows, setRows] = useState<AdminVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState("Venues")
  const [editing, setEditing] = useState<{ id: string | null; updatedAt: string | null; form: Form } | null>(null)
  const [formError, setFormError] = useState("")
  const [confirm, setConfirm] = useState<{ item: AdminVenue; action: "publish" | "archive" | "delete" } | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { setRows((await getAdminVenues()).venues) } catch (err) { setError(message(err)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const previewUrls = useRef(new Set<string>())
  useEffect(() => () => { for (const url of previewUrls.current) URL.revokeObjectURL(url); previewUrls.current.clear() }, [])
  const revoke = (url: string) => { URL.revokeObjectURL(url); previewUrls.current.delete(url) }
  const close = () => {
    if (editing) for (const photo of editing.form.photos) if (photo.file) revoke(photo.url)
    setEditing(null)
  }
  const openEdit = async (id: string) => {
    setBusy(true); setError("")
    try { const item = await getAdminVenue(id), version = item.draft || item.published; if (!version) throw new Error("This venue has no editable details."); setFormError(""); setEditing({ id, updatedAt: version.updatedAt, form: formFrom(version) }) }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  const field = <K extends keyof Form>(key: K, value: Form[K]) => setEditing(current => current ? { ...current, form: { ...current.form, [key]: value } } : current)
  const save = async () => {
    if (!editing) return
    setBusy(true); setFormError("")
    const uploaded: string[] = []
    try {
      const parseCapacity = (value: string) => { if (!value.trim()) return null; const number = Number(value); if (!Number.isInteger(number) || number < 1 || number > 2147483647) throw new Error("Capacity must be a positive whole number."); return number }
      const capacityMin = parseCapacity(editing.form.capacityMin), capacityMax = parseCapacity(editing.form.capacityMax)
      if (capacityMin !== null && capacityMax !== null && capacityMin > capacityMax) throw new Error("Minimum capacity cannot exceed maximum capacity.")
      const imageUrls: string[] = []
      for (const photo of editing.form.photos) { if (photo.file) { const url = await uploadVenueImage(photo.file); uploaded.push(url); imageUrls.push(url) } else imageUrls.push(photo.url) }
      const form: VenueContent = { name: editing.form.name, location: editing.form.location, description: editing.form.description, categories: editing.form.categories.map(value => value.trim()).filter(Boolean), capacityMin, capacityMax, imageUrls }
      if (editing.id && editing.updatedAt) await updateVenueDraft(editing.id, form, editing.updatedAt); else await createVenue(form)
      close(); setNotice("Venue draft saved."); await load()
    } catch (err) {
      let cleanupFailed = false
      for (const url of uploaded) try { await deleteUnreferencedVenueImage(url) } catch { cleanupFailed = true }
      const detail = err instanceof ApiError && err.status === 409 ? `${message(err)} This venue changed. Close and reopen it to load the latest details.` : message(err)
      setFormError(cleanupFailed ? `${detail} Some uploaded images could not be cleaned up.` : detail)
    } finally { setBusy(false) }
  }
  const act = async () => {
    if (!confirm) return
    setBusy(true); setError("")
    try {
      if (confirm.action === "publish") { if (!confirm.item.draft) throw new Error("There is no draft to publish."); await publishVenue(confirm.item.id, confirm.item.draft.updatedAt) }
      else if (confirm.action === "archive") await archiveVenue(confirm.item.id)
      else await deleteVenue(confirm.item.id)
      setNotice(`Venue ${confirm.action === "publish" ? "published" : confirm.action === "archive" ? "archived" : "deleted"}.`); setConfirm(null); await load()
    } catch (err) { setError(message(err)); setConfirm(null) } finally { setBusy(false) }
  }
  const ready = (version: VenueVersion) => !!version.name.trim() && !!version.location.trim() && !!version.description.trim() && version.imageUrls.length > 0 && version.capacityMin != null && version.capacityMax != null && Number.isInteger(version.capacityMin) && Number.isInteger(version.capacityMax) && version.capacityMin > 0 && version.capacityMin <= version.capacityMax
  const visible = rows.filter(item => tab === "Archives" ? !!item.archivedAt : !item.archivedAt)
  return <div className="service-panel">
    <div className="service-panel-heading"><div><h1>Venues</h1><p>Manage your venue catalog.</p></div>{tab === "Venues" && <Button disabled={busy} onClick={() => { setFormError(""); setEditing({ id: null, updatedAt: null, form: empty() }) }}>Create venue</Button>}</div>
    <Tabs className="package-tabs" active={tab} onChange={setTab} items={[{ value: "Venues", label: "Venues", count: rows.filter(item => !item.archivedAt).length }, { value: "Archives", label: "Archives", count: rows.filter(item => item.archivedAt).length }]} />
    {loading && <p role="status">Loading venues…</p>}{error && <p role="alert">{error} <button onClick={() => void load()}>Try again</button></p>}{notice && <p role="status">{notice}</p>}
    {!loading && !error && visible.length === 0 && <p>{tab === "Archives" ? "No archived venues found." : "No venues yet. Create a draft to get started."}</p>}
    <div className="service-grid">{visible.map(item => { const version = item.draft || item.published; if (!version) return null; return <article className="admin-package-card" key={item.id}>
      <div className="admin-package-image service-card-image">{version.imageUrls[0] ? <img src={venueImageSrc(version.imageUrls[0])} alt="" /> : <span className="venue-photo-fallback">No venue photos available</span>}<Badge tone={item.archivedAt ? "neutral" : item.draft ? "warning" : "success"}>{item.archivedAt ? "Archived" : item.draft ? item.published ? "Draft changes" : "Draft" : "Published"}</Badge></div>
      <div className="admin-package-body service-card-body"><span className="package-kind">{version.location || "Location not specified"}</span><h3 className="card-title">{version.name || "Untitled venue"}</h3><p>{version.description || "No description yet."}</p><div className="service-card-actions">{!item.archivedAt && <Button disabled={busy} onClick={() => void openEdit(item.id)}>Edit draft</Button>}{item.draft && !item.archivedAt && <Button disabled={busy} onClick={() => setConfirm({ item, action: "publish" })}>Publish draft</Button>}{item.published && !item.archivedAt && <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ item, action: "archive" })}>Archive</Button>}{!item.published && !item.archivedAt && <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ item, action: "delete" })}>Delete</Button>}</div></div>
    </article> })}</div>
    {editing && <Dialog title={editing.id ? "Edit venue draft" : "Create venue"} eyebrow="Venue catalog" onClose={() => { if (!busy && window.confirm("Discard unsaved changes?")) close() }} actions={<><Button variant="secondary" disabled={busy} onClick={() => { if (window.confirm("Discard unsaved changes?")) close() }}>Cancel</Button><Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save draft"}</Button></>}>
      {formError && <p role="alert">{formError}</p>}
      <div className="form-grid"><FormField className="full" label="Title *"><input value={editing.form.name} onChange={e => field("name", e.target.value)} /></FormField><FormField className="full" label="Location *"><input value={editing.form.location} onChange={e => field("location", e.target.value)} /></FormField><FormField className="full" label="Description *"><textarea value={editing.form.description} onChange={e => field("description", e.target.value)} /></FormField><TagInput label="Categories" values={editing.form.categories} onChange={value => field("categories", value)} /><FormField label="Minimum capacity"><input type="number" min="1" step="1" value={editing.form.capacityMin} onChange={e => field("capacityMin", e.target.value)} /></FormField><FormField label="Maximum capacity"><input type="number" min="1" step="1" value={editing.form.capacityMax} onChange={e => field("capacityMax", e.target.value)} /></FormField><FormField className="full" label="Photos (up to 10 JPEG or PNG files, 5 MiB each)"><input type="file" accept="image/jpeg,image/png" multiple disabled={busy} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ""; if (!files.length) return; if (editing.form.photos.length + files.length > 10 || files.some(file => !["image/jpeg", "image/png"].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024)) { setFormError("Choose up to 10 JPEG or PNG photos, each up to 5 MiB."); return } setFormError(""); field("photos", [...editing.form.photos, ...files.map(file => { const url = URL.createObjectURL(file); previewUrls.current.add(url); return { key: crypto.randomUUID(), url, file } })]) }} /></FormField><div className="full"><p>The first photo is the cover. Add at least one photo and both capacity values before publishing.</p><div className="venue-photo-list">{editing.form.photos.map((photo, index) => <div className="venue-photo" key={photo.key}><img src={photo.file ? photo.url : venueImageSrc(photo.url)} alt={`Venue photo ${index + 1}${index === 0 ? ", cover" : ""}`} /><span>{index === 0 ? "Cover" : `Photo ${index + 1}`}</span><button type="button" disabled={busy || index === 0} onClick={() => { const photos = [...editing.form.photos]; [photos[index - 1], photos[index]] = [photos[index], photos[index - 1]]; field("photos", photos) }}>Move earlier</button><button type="button" disabled={busy || index === editing.form.photos.length - 1} onClick={() => { const photos = [...editing.form.photos]; [photos[index + 1], photos[index]] = [photos[index], photos[index + 1]]; field("photos", photos) }}>Move later</button><button type="button" disabled={busy} onClick={() => { if (photo.file) revoke(photo.url); field("photos", editing.form.photos.filter((_, i) => i !== index)) }}>Remove</button></div>)}</div></div></div>
    </Dialog>}
    {confirm && <Dialog title={`${confirm.action === "publish" ? "Publish" : confirm.action === "archive" ? "Archive" : "Delete"} venue?`} onClose={() => { if (!busy) setConfirm(null) }} actions={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button><Button disabled={busy || (confirm.action === "publish" && (!confirm.item.draft || !ready(confirm.item.draft)))} onClick={() => void act()}>{busy ? "Please wait…" : confirm.action === "publish" ? "Publish" : confirm.action === "archive" ? "Archive" : "Delete"}</Button></>}><p>{confirm.action === "publish" ? "The server will validate and publish this draft. Complete the title, location, description, at least one photo, and valid minimum and maximum capacity before publishing." : confirm.action === "archive" ? "The venue will no longer appear in the public catalog." : "This permanently removes the never-published draft."}</p></Dialog>}
  </div>
}
