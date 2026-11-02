import { CatalogCard, CatalogCardActions } from "./CatalogCard"
import type { ReactNode } from "react"
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button, Dialog, FormField } from "@event-management/ui"
import { ApiError, archiveVenue, catalogMediaSrc, createVenue, deleteVenue, getAdminVenue, getAdminVenues, updateVenue, venueImageSrc } from "../../../lib/api"
import type { AdminVenue, VenueContent } from "../../../lib/api"
import { CatalogDetailPreview, VenueCanvas } from "../CatalogPreview"
import { TagInput } from "../TagInput"
import { CatalogEditor } from "./CatalogEditor"

const empty = (): VenueContent => ({ name: "", location: "", description: "", categories: [], capacityMax: null, imageUrls: [], sections: [{ id: crypto.randomUUID(), title: "", widgets: [] }] })
const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again."
const content = (version: AdminVenue): VenueContent => ({ name: version.name, location: version.location, description: version.description, categories: [...version.categories], capacityMax: version.capacityMax, imageUrls: [...version.imageUrls], sections: version.sections?.length ? version.sections : [{ id: crypto.randomUUID(), title: "", widgets: [] }] })
const cover = (version: VenueContent) => {
  const photo = version.sections?.flatMap(section => section.widgets).find(widget => widget.type === "photo" && widget.media?.url)
  return photo?.media?.url ? catalogMediaSrc(photo.media.url) : version.imageUrls[0] ? venueImageSrc(version.imageUrls[0]) : undefined
}

function VenueCard({ item, action }: { item: VenueContent; action?: ReactNode }) {
  return <CatalogCard image={cover(item)} imageFallback="No venue photos available" eyebrow={item.categories.join(" · ") || "Event venue"} title={item.name || "Untitled venue"} description={item.description} metadata={[{ label: "Location", value: item.location || "Not specified" }, { label: "Capacity", value: item.capacityMax == null ? "Not set" : `Up to ${item.capacityMax} guests` }]} action={action} />
}

export function VenuesPage() {
  const [rows, setRows] = useState<AdminVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState("Venues")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<VenueContent | null>(null)
  const savedRef = useRef<{ id: string | null; updatedAt: string | null }>({ id: null, updatedAt: null })
  const savedDuringEditRef = useRef(false)
  const [preview, setPreview] = useState<AdminVenue | null>(null)
  const [confirm, setConfirm] = useState<{ item: AdminVenue; action: "archive" | "delete" } | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { setRows((await getAdminVenues()).venues) } catch (err) { setError(message(err)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const openEdit = async (id: string) => {
    setBusy(true); setError("")
    try { const item = await getAdminVenue(id); savedDuringEditRef.current = false; savedRef.current = { id, updatedAt: item.updatedAt }; setEditing(content(item)) }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  const save = async (form: VenueContent) => {
    try {
      const { id, updatedAt } = savedRef.current
      const clean = { ...form, categories: form.categories.map(value => value.trim()).filter(Boolean) }
      const result = id && updatedAt ? await updateVenue(id, clean, updatedAt) : await createVenue(clean)
      savedRef.current = { id: result.id, updatedAt: result.updatedAt }
      savedDuringEditRef.current = true
    } catch (err) {
      throw new Error(err instanceof ApiError && err.status === 409 ? `${message(err)} This venue changed. Close and reopen it to load the latest details.` : message(err))
    }
  }
  const act = async () => {
    if (!confirm) return
    setBusy(true); setError("")
    try {
      if (confirm.action === "archive") await archiveVenue(confirm.item.id)
      else await deleteVenue(confirm.item.id)
      setNotice(`Venue ${confirm.action === "archive" ? "archived" : "deleted"}.`); setConfirm(null); await load()
    } catch (err) { setError(message(err)); setConfirm(null) } finally { setBusy(false) }
  }
  const visible = rows.filter(item => {
    if (tab === "Archives" ? !item.archivedAt : !!item.archivedAt) return false
    return `${item.name} ${item.location} ${item.description} ${item.categories.join(" ")}`.toLowerCase().includes(search.toLowerCase().trim())
  })
  return <div className="pe-list">
    <div className="pe-list-head"><div><h1>Venues</h1><p>Manage your venue catalog.</p></div>{tab === "Venues" && <button className="pe-primary" disabled={busy} onClick={() => { savedDuringEditRef.current = false; savedRef.current = { id: null, updatedAt: null }; setEditing(empty()) }}>+ Create venue</button>}</div>
    <div className="pe-tabs" role="tablist" aria-label="Venue catalog"><button role="tab" aria-selected={tab === "Venues"} onClick={() => setTab("Venues")}>Venues <span>{rows.filter(item => !item.archivedAt).length}</span></button><button role="tab" aria-selected={tab === "Archives"} onClick={() => setTab("Archives")}>Archives <span>{rows.filter(item => item.archivedAt).length}</span></button></div>
    <div className="pe-list-tools"><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search venues" aria-label="Search venues" /><span>{visible.length} {visible.length === 1 ? "venue" : "venues"}</span></div>
    {loading && <p role="status">Loading venues…</p>}{error && <p role="alert">{error} <button onClick={() => void load()}>Try again</button></p>}{notice && <p role="status">{notice}</p>}
    {!loading && !error && visible.length === 0 && <p>{search.trim() ? "No venues found." : tab === "Archives" ? "No archived venues found." : "No venues yet. Create one to get started."}</p>}
    <div className="pe-cards">{visible.map(item => {
      return <VenueCard key={item.id} item={item} action={<CatalogCardActions name={item.name || "Untitled venue"} disabled={busy} status={{ tone: item.archivedAt ? "neutral" : "success", label: item.archivedAt ? "Archived" : "Published" }} onEdit={item.archivedAt ? undefined : () => void openEdit(item.id)} actions={[
        { label: "Preview", onSelect: () => setPreview(item) },
        item.archivedAt ? { label: "Delete", onSelect: () => setConfirm({ item, action: "delete" }) } : { label: "Archive", onSelect: () => setConfirm({ item, action: "archive" }) },
      ]} />} />
    })}</div>
    {preview && <CatalogDetailPreview entity="venue" onClose={() => setPreview(null)}><VenueCanvas item={preview} /></CatalogDetailPreview>}
    {editing && <CatalogEditor initial={editing} entity="venue" nameMaxLength={200} onClose={() => { setEditing(null); if (savedDuringEditRef.current) void load() }} onSave={save} onSaved={() => { setEditing(null); setNotice("Venue saved."); void load() }} validate={form => {
      if (form.categories.length > 50 || form.categories.some(value => value.trim().length > 200)) return "Use up to 50 categories, each at most 200 characters."
      if (form.capacityMax != null && (!Number.isInteger(form.capacityMax) || form.capacityMax < 1 || form.capacityMax > 2147483647)) return "Capacity must be a positive whole number."
      if ((!form.name.trim() || !form.location.trim() || !form.description.trim() || form.capacityMax == null)) return "Complete the title, location, description, and maximum capacity before saving."
    }} renderDetails={(form, setForm) => <div className="form-grid"><FormField className="full" label="Location *"><input maxLength={200} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></FormField><FormField className="full" label="Catalog description *"><textarea maxLength={MAX_CATALOG_TEXT_LENGTH} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FormField><TagInput label="Categories" values={form.categories} onChange={value => setForm(current => ({ ...current, categories: value }))} /><small className="full">Up to 50 categories, each at most 200 characters.</small><FormField label="Maximum capacity"><input type="number" min="1" step="1" value={form.capacityMax ?? ""} onChange={e => setForm({ ...form, capacityMax: e.target.value === "" ? null : Number(e.target.value) })} /></FormField>{form.imageUrls.length > 0 && <div className="full"><p>Existing venue photos</p><div className="venue-photo-list">{form.imageUrls.map((url, index) => <div className="venue-photo" key={url}><img src={venueImageSrc(url)} alt={`Venue photo ${index + 1}`} /><button type="button" onClick={() => setForm(current => ({ ...current, imageUrls: current.imageUrls.filter((_, i) => i !== index) }))}>Remove</button></div>)}</div></div>}</div>} renderPreview={(form, mode) => mode === "customer" ? <VenueCanvas item={form} /> : <div className="pe-card-preview"><VenueCard item={form} action={<CatalogCardActions name={form.name} status={{ tone: "success", label: "Published" }} />} /></div>} />}
    {confirm && <Dialog title={`${confirm.action === "archive" ? "Archive" : "Delete"} venue?`} onClose={() => { if (!busy) setConfirm(null) }} actions={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button><Button disabled={busy} onClick={() => void act()}>{busy ? "Please wait…" : confirm.action === "archive" ? "Archive" : "Delete"}</Button></>}><p>{confirm.action === "archive" ? "The venue will no longer appear in the public catalog." : "This permanently removes the venue."}</p></Dialog>}

  </div>
}
