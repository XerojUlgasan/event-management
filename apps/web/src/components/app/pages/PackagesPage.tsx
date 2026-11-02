import { CatalogCard, CatalogCardActions } from "./CatalogCard"
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog"
import { CatalogEditor, newCatalogSection } from "./CatalogEditor"
import { useCallback, useEffect, useState } from "react"
import { archivePackage, createPackage, deletePackage, getAdminPackages, packageImageSrc, updatePackage } from "../../../lib/api"
import type { AdminPackage, PackageContent } from "../../../lib/api"
import { PackageCanvas, PackagePreview, priceLabel } from "../PackagePreview"
import { photos } from "../data"
import "../../../styles/package-editor.css"

const blank = (): PackageContent => ({ name: "", description: "", maxGuests: 100, price: { kind: "fixed", currency: "PHP", amountMinor: 0 }, sections: [newCatalogSection()] })
const message = (e: unknown) => e instanceof Error ? e.message : "Something went wrong."
function cover(item: PackageContent) { return item.sections.flatMap(s => s.widgets).find(w => w.type === "photo" && w.media)?.media?.url || null }
function Card({ item, action }: { item: PackageContent; action?: React.ReactNode }) {
  return <CatalogCard image={packageImageSrc(cover(item)) || photos.dinner} eyebrow="Event package" title={item.name || "Untitled package"} description={item.description} metadata={[{ label: "Package price", value: priceLabel(item.price).replace(/ total$/, "") }, { label: "Maximum guests", value: `Up to ${item.maxGuests} guests` }]} action={action} />
}
function Editor({ initial, onClose, onSaved }: { initial: AdminPackage | null; onClose: () => void; onSaved: () => void }) {
  return <CatalogEditor initial={initial ? { name: initial.name, description: initial.description, maxGuests: initial.maxGuests, price: initial.price, sections: initial.sections } : blank()} entity="package" onClose={onClose} onSaved={onSaved}
    validate={content => !content.name.trim() || !Number.isInteger(content.maxGuests) || content.maxGuests < 1 || !Number.isInteger(content.price.amountMinor) || content.price.amountMinor < 1 || content.price.amountMinor % 100 !== 0 ? "Enter a package name, a positive whole number of guests, and a whole peso price." : undefined}
    onSave={async content => { if (initial) await updatePackage(initial.id, content, initial.updatedAt); else await createPackage(content) }}
    renderDetails={(content, setContent) => <><label>Catalog description<textarea maxLength={MAX_CATALOG_TEXT_LENGTH} value={content.description} onChange={e => setContent({ ...content, description: e.target.value })} /></label><label>Maximum guests<input type="number" min="1" value={content.maxGuests || ""} onChange={e => setContent({ ...content, maxGuests: Number(e.target.value) })} /></label><label>Package price (PHP)<input type="number" min="1" step="1" value={content.price.amountMinor ? content.price.amountMinor / 100 : ""} onChange={e => setContent({ ...content, price: { ...content.price, amountMinor: Math.round(Number(e.target.value) * 100) } })} /></label></>}
    renderPreview={(content, mode) => mode === "customer" ? <PackageCanvas item={content} /> : <div className="pe-card-preview"><Card item={content} /></div>} />
}
export function PackagesPage() {
  const [rows, setRows] = useState<AdminPackage[]>([]), [search, setSearch] = useState(""), [archived, setArchived] = useState(false), [editing, setEditing] = useState<AdminPackage | "new" | null>(null), [preview, setPreview] = useState<AdminPackage | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); setError(""); try { setRows((await getAdminPackages()).packages) } catch (e) { setError(message(e)) } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const visible = rows.filter(p => !!p.archivedAt === archived && `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase().trim()))
  const act = async (item: AdminPackage, action: "archive" | "delete") => { if (!window.confirm(`${action === "archive" ? "Archive" : "Delete"} ${item.name}?`)) return; try { if (action === "archive") await archivePackage(item.id); else await deletePackage(item.id); await load() } catch (e) { setError(message(e)) } }
  return <div className="pe-list"><div className="pe-list-head"><div><h1>Packages</h1><p>Manage your package catalog.</p></div><button className="pe-primary" onClick={() => setEditing("new")}>+ Create package</button></div><div className="pe-tabs"><button aria-selected={!archived} onClick={() => setArchived(false)}>Packages <span>{rows.filter(r => !r.archivedAt).length}</span></button><button aria-selected={archived} onClick={() => setArchived(true)}>Archives <span>{rows.filter(r => r.archivedAt).length}</span></button></div><div className="pe-list-tools"><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search packages" aria-label="Search packages" /><span>{visible.length} {visible.length === 1 ? "package" : "packages"}</span></div>{loading && <p role="status">Loading packages…</p>}{error && <p role="alert">{error}</p>}<div className="pe-cards">{visible.map(item => <Card key={item.id} item={item} action={<CatalogCardActions name={item.name} status={{ label: archived ? "Archived" : "Published", tone: archived ? "neutral" : "success" }} actions={[{ label: "Preview", onSelect: () => setPreview(item) }, { label: archived ? "Delete" : "Archive", onSelect: () => void act(item, archived ? "delete" : "archive") }]} onEdit={archived ? undefined : () => setEditing(item)} />} />)}</div>{!loading && !visible.length && <p>No packages found.</p>}{editing && <Editor initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}{preview && <PackagePreview item={preview} allowBooking={false} onClose={() => setPreview(null)} />}</div>
}
