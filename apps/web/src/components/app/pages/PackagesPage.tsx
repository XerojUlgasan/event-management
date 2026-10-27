import { useCallback, useEffect, useState } from "react"
import { Badge, Button, Dialog, FormField, Icon, PageHeader, SearchField, Tabs } from "@event-management/ui"
import { ApiError, archivePackage, createPackage, deletePackage, getAdminPackage, getAdminPackages, publishPackage, updatePackageDraft, uploadPackageImage, deleteUnreferencedPackageImage, packageImageSrc } from "../../../lib/api"
import type { AdminPackage, PackageContent, PackageVersion } from "../../../lib/api"
import { photos } from "../data"
import { PackagePreview, priceLabel } from "../PackagePreview"

type Form = Omit<PackageContent, "eventTypes" | "inclusions" | "exclusions" | "price" | "guestMin" | "guestMax"> & {
  eventTypes: string[]; inclusions: string[]; exclusions: string[]; guestMin: string; guestMax: string; price: string
}
const emptyForm: Form = { name: "", eventTypes: [], description: "", guestMin: "30", guestMax: "100", venueDetails: "", inclusions: [], exclusions: [], terms: "", imageUrl: null, price: "" }
function formFrom(version: PackageVersion): Form {
  return { ...version, eventTypes: [...version.eventTypes], inclusions: [...version.inclusions], exclusions: [...version.exclusions], guestMin: String(version.guestMin), guestMax: String(version.guestMax), price: version.price ? (version.price.amountMinor / 100).toFixed(2) : "" }
}
function contentFrom(form: Form): PackageContent {
  const textFields = [form.name, form.description, form.venueDetails, form.terms, ...form.eventTypes, ...form.inclusions, ...form.exclusions]
  if (textFields.some(value => value.length > 4000)) throw new Error("Each text value must be 4,000 characters or fewer.")
  if (form.eventTypes.length > 50 || form.inclusions.length > 100 || form.exclusions.length > 100) throw new Error("Use up to 50 event types and 100 inclusions or exclusions.")
  if (form.imageUrl) {
    const imageUrl = form.imageUrl.trim()
    const uploaded = /^\/v1\/package-images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageUrl)
    let external = false
    try { const url = new URL(imageUrl); external = url.protocol === "http:" || url.protocol === "https:" } catch { /* Invalid URL */ }
    if (imageUrl.length > 2048 || (!uploaded && !external)) throw new Error("Enter a valid HTTP or HTTPS image URL.")
  }
  const min = Number(form.guestMin), max = Number(form.guestMax)
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 30 || max > 100 || min > max) throw new Error("Guest range must be between 30 and 100, with minimum no greater than maximum.")
  let price: PackageContent["price"] = null
  if (form.price.trim()) {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(form.price.trim())
    if (!match) throw new Error("Enter a peso amount with up to two decimal places.")
    const amountMinor = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"))
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > 2147483647) throw new Error("The price must be greater than zero and no more than ₱21,474,836.47.")
    price = { kind: "fixed", currency: "PHP", amountMinor }
  }
  return { name: form.name, description: form.description, venueDetails: form.venueDetails, terms: form.terms, eventTypes: form.eventTypes, inclusions: form.inclusions, exclusions: form.exclusions, guestMin: min, guestMax: max, imageUrl: form.imageUrl?.trim() || null, price }
}
const message = (err: unknown) => err instanceof Error ? err.message : "Something went wrong. Please try again."
const steps = ["Essentials", "Experience", "Pricing & media"]
type Requirement = { label: string; step: number }
function missing(form: Form): Requirement[] {
  const result: Requirement[] = []
  if (!form.name.trim()) result.push({ label: "Package name", step: 0 })
  if (!form.eventTypes.length) result.push({ label: "At least one event type", step: 0 })
  if (!form.description.trim()) result.push({ label: "Description", step: 0 })
  const min = Number(form.guestMin), max = Number(form.guestMax)
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 30 || max > 100 || min > max) result.push({ label: "Valid guest range (30–100)", step: 0 })
  if (!form.venueDetails.trim()) result.push({ label: "Venue details", step: 1 })
  if (!form.inclusions.length) result.push({ label: "At least one inclusion", step: 1 })
  if (!form.terms.trim()) result.push({ label: "Terms", step: 1 })
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(form.price.trim()) || Number(form.price) <= 0 || Number(form.price) > 21474836.47) result.push({ label: "Valid fixed PHP price", step: 2 })
  return result
}
function TagInput({ label, values, onChange, required = false }: { label: string; values: string[]; onChange: (values: string[]) => void; required?: boolean }) {
  const [input, setInput] = useState("")
  const inputId = `tags-${label.toLowerCase().replace(/\s+/g, "-")}`
  const add = () => {
    const entries = input.split(",").map(value => value.trim()).filter(Boolean)
    if (entries.length) onChange([...new Set([...values, ...entries])])
    setInput("")
  }
  return <div className="package-tag-field full"><div className="package-tag-heading"><label htmlFor={inputId}>{label}{required && " *"}</label>{values.length > 0 && <button type="button" aria-label={`Remove all ${label.toLowerCase()}`} onClick={() => onChange([])}>Remove all</button>}</div><div className="package-tags">{values.map(value => <span className="package-tag" key={value}>{value}<button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter(item => item !== value))}>×</button></span>)}<input id={inputId} value={input} placeholder={values.length ? "Add another" : `Add ${label.toLowerCase()}`} onChange={event => setInput(event.target.value)} onBlur={add} onKeyDown={event => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add() } }} /></div><small>Type a value and press Enter or comma.</small></div>
}


export function PackagesPage() {
  const [rows, setRows] = useState<AdminPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [tab, setTab] = useState("Packages")
  const [editing, setEditing] = useState<{ id: string | null; updatedAt: string | null; form: Form } | null>(null)
  const [formError, setFormError] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedImage) { setImagePreview(null); return }
    const url = URL.createObjectURL(selectedImage)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedImage])
  const [step, setStep] = useState(0)
  const [preview, setPreview] = useState<PackageVersion | null>(null)
  const [confirm, setConfirm] = useState<{ item: AdminPackage; action: "publish" | "archive" | "delete" } | null>(null)
  const [notice, setNotice] = useState("")
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { setRows((await getAdminPackages()).packages) } catch (err) { setError(message(err)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const openEdit = async (id: string) => {
    setBusy(true); setError("")
    try {
      const item = await getAdminPackage(id)
      const version = item.draft || item.published
      if (!version) throw new Error("This package has no editable version.")
      setFormError(""); setStep(0); setSelectedImage(null); setEditing({ id, updatedAt: version.updatedAt, form: formFrom(version) })
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  const save = async () => {
    if (!editing) return
    setFormError(""); setBusy(true)
    let uploadedImage: string | null = null
    try {
      const content = contentFrom(editing.form)
      if (selectedImage) {
        setUploadingImage(true)
        try { uploadedImage = await uploadPackageImage(selectedImage) } finally { setUploadingImage(false) }
        content.imageUrl = uploadedImage
      }
      if (editing.id && editing.updatedAt) await updatePackageDraft(editing.id, content, editing.updatedAt)
      else await createPackage(content)
      setEditing(null); setSelectedImage(null); setNotice("Draft saved."); await load()
    } catch (err) {
      let cleanupFailed = false
      if (uploadedImage) {
        try { await deleteUnreferencedPackageImage(uploadedImage) } catch { cleanupFailed = true }
      }
      const detail = err instanceof ApiError && err.status === 409 ? `${message(err)} This package changed. Close and reopen it to load the latest version.` : message(err)
      setFormError(cleanupFailed ? `${detail} The uploaded image could not be cleaned up.` : detail)
    } finally { setBusy(false) }
  }
  const act = async () => {
    if (!confirm) return
    setBusy(true); setError("")
    try {
      if (confirm.action === "publish") {
        if (!confirm.item.draft) throw new Error("There is no draft to publish.")
        await publishPackage(confirm.item.id, confirm.item.draft.updatedAt)
      }
      else if (confirm.action === "archive") await archivePackage(confirm.item.id)
      else await deletePackage(confirm.item.id)
      setNotice(`Package ${confirm.action === "publish" ? "published" : confirm.action === "archive" ? "archived" : "deleted"}.`); setConfirm(null); await load()
    } catch (err) { setError(err instanceof ApiError && err.status === 409 ? `${message(err)} Refresh the list and review the latest draft before trying again.` : message(err)); setConfirm(null) } finally { setBusy(false) }
  }
  const visible = rows.filter(item => {
    const version = item.draft || item.published
    const matchesSearch = !search.trim() || `${version?.name || ""} ${version?.eventTypes.join(" ") || ""}`.toLowerCase().includes(search.toLowerCase().trim())
    return matchesSearch && (status === "all" || (status === "archived" ? !!item.archivedAt : status === "draft" ? !!item.draft && !item.archivedAt : !!item.published && !item.archivedAt))
  })
  const setField = <K extends keyof Form>(key: K, value: Form[K]) => setEditing(current => current ? { ...current, form: { ...current.form, [key]: value } } : current)
  return <div className="content-stack packages-page">
    <PageHeader title="Packages & quotations" description="Manage your package catalog." actions={tab === "Packages" ? <Button icon="box" disabled={busy} onClick={() => { setFormError(""); setStep(0); setSelectedImage(null); setEditing({ id: null, updatedAt: null, form: { ...emptyForm } }) }}>Create package</Button> : undefined} />
    <Tabs className="package-tabs" active={tab} onChange={setTab} items={[{ value: "Packages", label: "Packages", count: rows.length }, { value: "Quotations", label: "Quotations" }, { value: "Menus", label: "Menus" }]} />
    {tab !== "Packages" ? <p>{tab} are not connected yet.</p> : <>
      <div className="package-admin-summary"><div><span>Published</span><strong>{rows.filter(item => item.published && !item.archivedAt).length}</strong><small>Visible to customers</small></div><div><span>Drafts</span><strong>{rows.filter(item => item.draft && !item.archivedAt).length}</strong><small>Awaiting publication</small></div><div><span>Archived</span><strong>{rows.filter(item => item.archivedAt).length}</strong><small>Hidden from customers</small></div></div>
      <div className="table-tools package-tools"><SearchField value={search} onChange={event => setSearch(event.target.value)} placeholder="Search packages" /><select aria-label="Package status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></div>
      {loading && <p>Loading packages…</p>}{error && <p role="alert">{error} <button onClick={() => void load()}>Try again</button></p>}{notice && <p role="status">{notice}</p>}
      {!loading && !error && visible.length === 0 && <p>No packages found.</p>}
      <div className="admin-package-grid">{visible.map(item => {
        const version = item.draft || item.published
        if (!version) return null
        return <article className="admin-package-card" key={item.id}><div className="admin-package-image"><img src={packageImageSrc(version.imageUrl) || photos.dinner} alt="" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = photos.dinner }} /><Badge tone={item.archivedAt ? "neutral" : item.draft ? "warning" : "success"}>{item.archivedAt ? "Archived" : item.draft ? item.published ? "Draft changes" : "Draft" : "Published"}</Badge></div><div className="admin-package-body"><span className="package-kind">{version.eventTypes.join(", ")}</span><div className="card-title">{version.name || "Untitled package"}</div><p>{version.description}</p><div className="admin-package-data"><span><small>Price</small><strong>{priceLabel(version.price)}</strong></span><span><small>Capacity</small><strong>{version.guestMin}–{version.guestMax} guests</strong></span><span><small>Version</small><strong>{version.version}</strong></span></div><div className="admin-package-actions"><Button variant="secondary" onClick={() => setPreview(version)}>Preview</Button>{!item.archivedAt && <Button disabled={busy} onClick={() => void openEdit(item.id)}>Edit draft</Button>}{item.draft && !item.archivedAt && <Button disabled={busy} onClick={() => setConfirm({ item, action: "publish" })}>Publish draft</Button>}{!item.archivedAt && item.published && <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ item, action: "archive" })}>Archive</Button>}{!item.published && !item.archivedAt && <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ item, action: "delete" })}>Delete</Button>}</div></div></article>
      })}<button className="new-package-card" onClick={() => { setFormError(""); setStep(0); setSelectedImage(null); setEditing({ id: null, updatedAt: null, form: { ...emptyForm } }) }}><span><Icon name="box" /></span><strong>Create a new package</strong><small>Start with a draft.</small></button></div>
    </>}
    {editing && <Dialog className="package-wizard" onClose={() => { if (!busy && window.confirm("Discard unsaved changes?")) { setEditing(null); setSelectedImage(null) } }} eyebrow="Event package" title={editing.id ? "Edit draft" : "Create package"} actions={<><Button variant="secondary" disabled={busy} onClick={() => { if (step > 0) setStep(step - 1); else if (window.confirm("Discard unsaved changes?")) { setEditing(null); setSelectedImage(null) } }}>{step > 0 ? "Back" : "Cancel"}</Button>{step < 2 ? <Button disabled={busy} onClick={() => setStep(step + 1)}>Continue</Button> : <Button disabled={busy} onClick={() => void save()}>{uploadingImage ? "Uploading image…" : busy ? "Saving…" : "Save draft"}</Button>}</>}>
      <div className="package-steps" aria-label="Package editor steps">{steps.map((name, index) => <button type="button" key={name} className={step === index ? "active" : ""} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}><span>{index + 1}</span>{name}</button>)}</div>
      {formError && <p role="alert">{formError}</p>}
      {step === 0 && <div className="form-grid"><FormField label="Package name *"><input value={editing.form.name} onChange={e => setField("name", e.target.value)} /></FormField><TagInput label="Event types" required values={editing.form.eventTypes} onChange={value => setField("eventTypes", value)} /><FormField className="full" label="Description *"><textarea value={editing.form.description} onChange={e => setField("description", e.target.value)} /></FormField><FormField label="Minimum guests *"><input type="number" min="30" max="100" value={editing.form.guestMin} onChange={e => setField("guestMin", e.target.value)} /></FormField><FormField label="Maximum guests *"><input type="number" min="30" max="100" value={editing.form.guestMax} onChange={e => setField("guestMax", e.target.value)} /></FormField></div>}
      {step === 1 && <div className="form-grid"><FormField className="full" label="Venue details *"><textarea value={editing.form.venueDetails} onChange={e => setField("venueDetails", e.target.value)} /></FormField><TagInput label="Inclusions" required values={editing.form.inclusions} onChange={value => setField("inclusions", value)} /><TagInput label="Exclusions" values={editing.form.exclusions} onChange={value => setField("exclusions", value)} /><FormField className="full" label="Terms *"><textarea value={editing.form.terms} onChange={e => setField("terms", e.target.value)} /></FormField></div>}
      {step === 2 && <><div className="form-grid"><FormField label="Package total (PHP) *"><input inputMode="decimal" placeholder="e.g. 50000.00" value={editing.form.price} onChange={e => setField("price", e.target.value)} /></FormField><FormField label="Image URL"><input type="url" placeholder="https://..." value={editing.form.imageUrl || ""} onChange={e => { setSelectedImage(null); setField("imageUrl", e.target.value) }} /></FormField><FormField className="full" label="Or upload a JPEG or PNG (up to 5 MiB)"><input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) { setFormError("Choose a JPEG or PNG image up to 5 MiB."); return } setFormError(""); setSelectedImage(file); setField("imageUrl", null) }} /></FormField>{selectedImage && <p className="full package-selected-image" role="status">Selected: {selectedImage.name} · uploaded when you save</p>}{(imagePreview || editing.form.imageUrl) && <div className="full package-image-preview"><img src={imagePreview || packageImageSrc(editing.form.imageUrl)} alt="Package preview" /><button type="button" onClick={() => { setSelectedImage(null); setField("imageUrl", null) }}>Remove image</button></div>}</div><div className="package-requirements"><strong>{missing(editing.form).length ? "Before publishing" : "Ready to publish"}</strong><p>{missing(editing.form).length ? "You can save this draft now. Complete these details before publishing:" : "All required details are present. Save the draft, then publish it from the package list."}</p>{missing(editing.form).length > 0 && <ul>{missing(editing.form).map(item => <li key={item.label}><button type="button" onClick={() => setStep(item.step)}>{item.label}</button></li>)}</ul>}</div></>}
    </Dialog>}
    {preview && <PackagePreview item={preview} versionState={preview.state} onClose={() => setPreview(null)} />}
    {confirm && <Dialog onClose={() => { if (!busy) setConfirm(null) }} title={`${confirm.action === "publish" ? "Publish" : confirm.action === "archive" ? "Archive" : "Delete"} package?`} actions={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button>{confirm.action === "publish" && confirm.item.draft && missing(formFrom(confirm.item.draft)).length > 0 ? <Button disabled={busy} onClick={() => { const id = confirm.item.id; setConfirm(null); void openEdit(id) }}>Edit draft</Button> : <Button disabled={busy} onClick={() => void act()}>{busy ? "Please wait…" : confirm.action === "publish" ? "Publish" : confirm.action === "archive" ? "Archive" : "Delete"}</Button>}</>}><p>{confirm.action === "publish" ? "The draft will become visible to customers after the server validates it." : confirm.action === "archive" ? "The package will be hidden from customers and its versions retained." : "This permanently removes the never-published draft."}</p>{confirm.action === "publish" && confirm.item.draft && missing(formFrom(confirm.item.draft)).length > 0 && <div className="package-requirements"><strong>Complete these details first</strong><ul>{missing(formFrom(confirm.item.draft)).map(item => <li key={item.label}>{item.label}</li>)}</ul></div>}</Dialog>}
  </div>
}
