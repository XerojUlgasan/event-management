import { MAX_VENUE_PHOTOS } from "@event-management/contracts/limits/venues"
import { useCallback, useEffect, useState } from "react"
import { Badge, Button, Dialog, FormField, Tabs } from "@event-management/ui"
import { ApiError, archiveVenue, createVenue, deleteVenue, getAdminVenue, getAdminVenues, publishVenue, updateVenueDraft, venueImageSrc } from "../../../lib/api"
import type { AdminVenue, VenueContent, VenueVersion } from "../../../lib/api"
import { TagInput } from "../TagInput"

type Photo = { key: string; url: string }
type Form = Omit<VenueContent, "capacityMax" | "imageUrls"> & { capacityMax: string; photos: Photo[] }
const empty = (): Form => ({ name: "", location: "", description: "", categories: [], capacityMax: "", photos: [] })
const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again."
function formFrom(version: VenueVersion): Form {
  return { name: version.name, location: version.location, description: version.description, categories: [...version.categories], capacityMax: version.capacityMax == null ? "" : String(version.capacityMax), photos: version.imageUrls.map(url => ({ key: url, url })) }
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
  const [newPhotoUrl, setNewPhotoUrl] = useState("")
  const [confirm, setConfirm] = useState<{ item: AdminVenue; action: "publish" | "archive" | "delete" } | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { setRows((await getAdminVenues()).venues) } catch (err) { setError(message(err)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const close = () => {
    setEditing(null)
    setNewPhotoUrl("")
  }
  const openEdit = async (id: string) => {
    setBusy(true); setError("")
    try { const item = await getAdminVenue(id), version = item.draft || item.published; if (!version) throw new Error("This venue has no editable details."); setFormError(""); setNewPhotoUrl(""); setEditing({ id, updatedAt: version.updatedAt, form: formFrom(version) }) }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  const field = <K extends keyof Form>(key: K, value: Form[K]) => setEditing(current => current ? { ...current, form: { ...current.form, [key]: value } } : current)
  const addPhoto = () => {
    const url = newPhotoUrl.trim()
    if (!editing || !url) return
    try { if (new URL(url).protocol !== "https:" || url.length > 2048) throw new Error() }
    catch { setFormError("Enter a valid HTTPS photo URL."); return }
    if (editing.form.photos.some(photo => photo.url.toLowerCase() === url.toLowerCase())) { setFormError("Each photo URL must be unique."); return }
    if (editing.form.photos.length >= MAX_VENUE_PHOTOS) { setFormError(`Use up to ${MAX_VENUE_PHOTOS} photo URLs.`); return }
    field("photos", [...editing.form.photos, { key: crypto.randomUUID(), url }])
    setNewPhotoUrl(""); setFormError("")
  }
  const save = async () => {
    if (!editing) return
    setBusy(true); setFormError("")
    try {
      const parseCapacity = (value: string) => { if (!value.trim()) return null; const number = Number(value); if (!Number.isInteger(number) || number < 1 || number > 2147483647) throw new Error("Capacity must be a positive whole number."); return number }
      const capacityMax = parseCapacity(editing.form.capacityMax)
      const imageUrls = editing.form.photos.map(photo => photo.url.trim())
      if (imageUrls.length > MAX_VENUE_PHOTOS || new Set(imageUrls.map(url => url.toLowerCase())).size !== imageUrls.length || imageUrls.some(url => { try { return new URL(url).protocol !== "https:" || url.length > 2048 } catch { return true } })) throw new Error("Enter up to 10 unique HTTPS photo URLs.")
      const form: VenueContent = { name: editing.form.name, location: editing.form.location, description: editing.form.description, categories: editing.form.categories.map(value => value.trim()).filter(Boolean), capacityMax, imageUrls }
      if (editing.id && editing.updatedAt) await updateVenueDraft(editing.id, form, editing.updatedAt); else await createVenue(form)
      close(); setNotice("Venue draft saved."); await load()
    } catch (err) {
      const detail = err instanceof ApiError && err.status === 409 ? `${message(err)} This venue changed. Close and reopen it to load the latest details.` : message(err)
      setFormError(detail)
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
  const ready = (version: VenueVersion) => !!version.name.trim() && !!version.location.trim() && !!version.description.trim() && version.capacityMax != null && Number.isInteger(version.capacityMax) && version.capacityMax > 0
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
      <div className="form-grid"><FormField className="full" label="Title *"><input value={editing.form.name} onChange={e => field("name", e.target.value)} /></FormField><FormField className="full" label="Location *"><input value={editing.form.location} onChange={e => field("location", e.target.value)} /></FormField><FormField className="full" label="Description *"><textarea value={editing.form.description} onChange={e => field("description", e.target.value)} /></FormField><TagInput label="Categories" values={editing.form.categories} onChange={value => field("categories", value)} /><FormField label="Maximum capacity"><input type="number" min="1" step="1" value={editing.form.capacityMax} onChange={e => field("capacityMax", e.target.value)} /></FormField><FormField className="full" label="Photo URL"><div><input type="url" placeholder="https://..." value={newPhotoUrl} disabled={busy || editing.form.photos.length >= MAX_VENUE_PHOTOS} onChange={e => setNewPhotoUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPhoto() } }} /><button type="button" disabled={busy || !newPhotoUrl.trim() || editing.form.photos.length >= MAX_VENUE_PHOTOS} onClick={addPhoto}>Add photo URL</button><p>Up to {MAX_VENUE_PHOTOS} HTTPS photo URLs; the first is the cover.</p></div></FormField><div className="full"><div className="venue-photo-list">{editing.form.photos.map((photo, index) => <div className="venue-photo" key={photo.key}><img src={venueImageSrc(photo.url)} alt={`Venue photo ${index + 1}${index === 0 ? ", cover" : ""}`} /><span>{index === 0 ? "Cover" : `Photo ${index + 1}`}</span><button type="button" disabled={busy || index === 0} onClick={() => { const photos = [...editing.form.photos]; [photos[index - 1], photos[index]] = [photos[index], photos[index - 1]]; field("photos", photos) }}>Move earlier</button><button type="button" disabled={busy || index === editing.form.photos.length - 1} onClick={() => { const photos = [...editing.form.photos]; [photos[index + 1], photos[index]] = [photos[index], photos[index + 1]]; field("photos", photos) }}>Move later</button><button type="button" disabled={busy} onClick={() => field("photos", editing.form.photos.filter((_, i) => i !== index))}>Remove</button></div>)}</div></div></div>
    </Dialog>}
    {confirm && <Dialog title={`${confirm.action === "publish" ? "Publish" : confirm.action === "archive" ? "Archive" : "Delete"} venue?`} onClose={() => { if (!busy) setConfirm(null) }} actions={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button><Button disabled={busy || (confirm.action === "publish" && (!confirm.item.draft || !ready(confirm.item.draft)))} onClick={() => void act()}>{busy ? "Please wait…" : confirm.action === "publish" ? "Publish" : confirm.action === "archive" ? "Archive" : "Delete"}</Button></>}><p>{confirm.action === "publish" ? "The server will validate and publish this draft. Complete the title, location, description, and valid maximum capacity before publishing. Photos are optional." : confirm.action === "archive" ? "The venue will no longer appear in the public catalog." : "This permanently removes the never-published draft."}</p></Dialog>}
  </div>
}
