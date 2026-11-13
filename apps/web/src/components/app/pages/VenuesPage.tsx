import { usePagination } from "../../../lib/use-pagination";
import { CatalogCard, CatalogCardActions } from "./CatalogCard"
import type { ReactNode } from "react"
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button, Pagination, Dialog, FormField, Input, PageHeader, SearchField, Tabs, Textarea, useNotifications } from "@event-management/ui"
import { ApiError } from "../../../lib/http"
import { catalogMediaSrc } from "../../../lib/data/catalog-media"
import { archiveVenue, createVenue, deleteVenue, getAdminVenue, getAdminVenues, updateVenue, type AdminVenue, type VenueContent } from "../../../lib/data/venues"
import { CatalogDetailPreview, VenueCanvas } from "../CatalogPreview"
import { CatalogEditor } from "./CatalogEditor"

const empty = (): VenueContent => ({ name: "", location: "", description: "", maxGuests: null, sections: [{ id: crypto.randomUUID(), title: "", widgets: [] }] })
const content = (version: AdminVenue): VenueContent => ({ name: version.name, location: version.location, description: version.description, maxGuests: version.maxGuests, sections: version.sections?.length ? version.sections : [{ id: crypto.randomUUID(), title: "", widgets: [] }] })
const cover = (version: VenueContent) => {
  const photo = version.sections?.flatMap(section => section.widgets).find(widget => widget.type === "photo" && widget.media?.url)
  return photo?.media?.url ? catalogMediaSrc(photo.media.url) : undefined
}

function VenueCard({ item, action }: { item: VenueContent; action?: ReactNode }) {
  return <CatalogCard image={cover(item)} imageFallback="No venue photos available" eyebrow="Event venue" title={item.name || "Untitled venue"} description={item.description} metadata={[{ label: "Location", value: item.location || "Not specified" }, { label: "Maximum guests", value: item.maxGuests == null ? "Not set" : `Up to ${item.maxGuests} guests` }]} action={action} />
}

export function VenuesPage() {
  const { notify, notifyError } = useNotifications()
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [counts, setCounts] = useState({ active: 0, archived: 0, filtered: 0 });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const requestId = useRef(0);
  const [rows, setRows] = useState<AdminVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState("Venues")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<VenueContent | null>(null)
  const savedRef = useRef<{ id: string | null; updatedAt: string | null }>({ id: null, updatedAt: null })
  const savedDuringEditRef = useRef(false)
  const [preview, setPreview] = useState<AdminVenue | null>(null)
  const [confirm, setConfirm] = useState<{ item: AdminVenue; action: "archive" | "delete" } | null>(null)
  const pagination = usePagination(`${tab}:${search}`);
  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError("")
    try { const result = await getAdminVenues({ cursor: pagination.cursor, search, archived: tab === "Archives" ? "archived" : "active" }); if (mounted.current && current === requestId.current) { setRows(result.venues); setNextCursor(result.nextCursor); setCounts(result.counts) } } catch (err) { if (mounted.current && current === requestId.current) setError(notifyError(err, "Something went wrong. Please try again.")) } finally { if (mounted.current && current === requestId.current) setLoading(false) }
  }, [notifyError, pagination.cursor, search, tab])
  useEffect(() => { void load(); return () => { requestId.current++ } }, [load])
  const openEdit = async (id: string) => {
    setBusy(true); setError("")
    try { const item = await getAdminVenue(id); if (!mounted.current) return; savedDuringEditRef.current = false; savedRef.current = { id, updatedAt: item.updatedAt }; setEditing(content(item)) }
    catch (err) { if (mounted.current) setError(notifyError(err, "Something went wrong. Please try again.")) } finally { if (mounted.current) setBusy(false) }
  }
  const save = async (form: VenueContent) => {
    try {
      const { id, updatedAt } = savedRef.current
      const result = id && updatedAt ? await updateVenue(id, form, updatedAt) : await createVenue(form)
      savedRef.current = { id: result.id, updatedAt: result.updatedAt }
      savedDuringEditRef.current = true
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) throw new Error(`${err.message} This venue changed. Close and reopen it to load the latest details.`)
      throw err
    }
  }
  const act = async () => {
    if (!confirm) return
    setBusy(true); setError("")
    try {
      if (confirm.action === "archive") await archiveVenue(confirm.item.id)
      else await deleteVenue(confirm.item.id)
      notify(`Venue ${confirm.action === "archive" ? "archived" : "deleted"}.`); setConfirm(null); await load()
    } catch (err) { setError(notifyError(err, "Something went wrong. Please try again.")); setConfirm(null) } finally { setBusy(false) }
  }
  const visible = rows
  return <div className="pe-list">
    <PageHeader className="pe-list-head" title="Venues" description="Manage your venue catalog." actions={tab === "Venues" && <Button disabled={busy} onClick={() => { savedDuringEditRef.current = false; savedRef.current = { id: null, updatedAt: null }; setEditing(empty()) }}>+ Create venue</Button>} />
    <Tabs className="pe-tabs" role="group" aria-label="Venue catalog" active={tab} onChange={value => { setTab(value) }} items={[{ value: "Venues", label: "Venues", count: counts.active }, { value: "Archives", label: "Archives", count: counts.archived }]} />
    <div className="pe-list-tools"><SearchField type="search" value={search} onChange={event => { setSearch(event.target.value.slice(0, 200)) }} placeholder="Search venues" ariaLabel="Search venues" /><span>{counts.filtered} {counts.filtered === 1 ? "venue" : "venues"}</span></div>
    {loading && <p role="status">Loading venues…</p>}{error && <p role="alert">{error} <Button variant="secondary" onClick={() => void load()}>Try again</Button></p>}
    {!loading && !error && visible.length === 0 && <p>{search.trim() ? "No venues found." : tab === "Archives" ? "No archived venues found." : "No venues yet. Create one to get started."}</p>}
    <div className="pe-cards">{visible.map(item => {
      return <VenueCard key={item.id} item={item} action={<CatalogCardActions name={item.name || "Untitled venue"} disabled={busy} status={{ tone: item.archivedAt ? "neutral" : "success", label: item.archivedAt ? "Archived" : "Published" }} onEdit={item.archivedAt ? undefined : () => void openEdit(item.id)} actions={[
        { label: "Preview", onSelect: () => setPreview(item) },
        item.archivedAt ? { label: "Delete", onSelect: () => setConfirm({ item, action: "delete" }) } : { label: "Archive", onSelect: () => setConfirm({ item, action: "archive" }) },
      ]} />} />
    })}</div>
    <Pagination page={pagination.page} hasNextPage={nextCursor !== null} pending={loading} onPrevious={pagination.previous} onNext={() => pagination.next(nextCursor)} label="Catalog pages" />
    {preview && <CatalogDetailPreview entity="venue" onClose={() => setPreview(null)}><VenueCanvas item={preview} /></CatalogDetailPreview>}
    {editing && <CatalogEditor initial={editing} entity="venue" nameMaxLength={200} onClose={() => { setEditing(null); if (savedDuringEditRef.current) void load() }} onSave={save} onSaved={() => { setEditing(null); void load() }} validate={form => {
      if (form.maxGuests != null && (!Number.isInteger(form.maxGuests) || form.maxGuests < 1 || form.maxGuests > 2147483647)) return "Maximum guests must be a positive whole number."
      if ((!form.name.trim() || !form.location.trim() || !form.description.trim() || form.maxGuests == null)) return "Complete the title, location, description, and maximum guests before saving."
    }} renderDetails={(form, setForm) => <div className="form-grid"><FormField className="full" label="Location *"><Input maxLength={200} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></FormField><FormField className="full" label="Catalog description *"><Textarea maxLength={MAX_CATALOG_TEXT_LENGTH} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FormField><FormField label="Maximum guests"><Input type="number" min="1" step="1" value={form.maxGuests ?? ""} onChange={e => setForm({ ...form, maxGuests: e.target.value === "" ? null : Number(e.target.value) })} /></FormField></div>} renderPreview={(form, mode) => mode === "customer" ? <VenueCanvas item={form} /> : <div className="pe-card-preview"><VenueCard item={form} action={<CatalogCardActions name={form.name} status={{ tone: "success", label: "Published" }} />} /></div>} />}
    {confirm && <Dialog title={`${confirm.action === "archive" ? "Archive" : "Delete"} venue?`} onClose={() => { if (!busy) setConfirm(null) }} actions={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button><Button variant={confirm.action === "delete" ? "danger" : "primary"} pending={busy} onClick={() => void act()}>{busy ? "Please wait…" : confirm.action === "archive" ? "Archive" : "Delete"}</Button></>}><p>{confirm.action === "archive" ? "The venue will no longer appear in the public catalog." : "This permanently removes the venue."}</p></Dialog>}

  </div>
}
