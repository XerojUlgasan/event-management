import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import "@uiw/react-markdown-preview/markdown.css"
import rehypeSanitize from "rehype-sanitize"
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images"
import { Badge, Button, Dialog, FormField, Tabs } from "@event-management/ui"
import { ApiError, archiveService, createService, deleteService, getAdminService, getAdminServices, publishService, serviceImageSrc, updateServiceDraft, uploadService } from "../../../lib/api"
import type { AdminService, ServiceContent, ServiceVersion } from "../../../lib/api"

const empty: ServiceContent = { name: "", description: "", hourlyRatePesos: null }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again."
const rateLabel = (rate: number | null) => rate == null ? "Rate not set" : `${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(rate)} / hour`
function content(version: ServiceVersion): ServiceContent {
  return { name: version.name, description: version.description, hourlyRatePesos: version.hourlyRatePesos }
}
type Editing = { id: string | null; updatedAt: string | null; form: ServiceContent; imageId: string | null; removeImage: boolean; file: File | null }

function ServicePreview({ version, imageSrc, onClose }: { version: ServiceContent & { imageId: string | null; state: ServiceVersion["state"] }; imageSrc?: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = "hidden"
    dialog?.querySelector<HTMLButtonElement>("button")?.focus()
    return () => { dialog?.close(); document.body.style.overflow = overflow; trigger?.focus() }
  }, [])
  return createPortal(<dialog ref={dialogRef} className="package-preview service-admin-preview" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="package-preview-bar"><button type="button" className="package-preview-close" aria-label="Close service preview" onClick={onClose}>×</button><span className="package-preview-brand">Clemora</span><span className="package-preview-divider" aria-hidden="true" /><span className="package-preview-label">Service preview</span><span className="package-preview-admin">{version.state === "draft" ? "Draft preview" : "Published preview"}</span></header>
    <div className="package-preview-scroll"><main className="package-preview-main"><div className="package-preview-topline"><span>Service</span><span>{rateLabel(version.hourlyRatePesos)}</span></div><div className="service-admin-preview-hero">{(imageSrc || version.imageId) && <img src={imageSrc || serviceImageSrc(version.imageId)} alt="" />}<div><span className="package-preview-overline">The detail</span><h1 id={titleId}>{version.name || "Untitled service"}</h1><strong>{rateLabel(version.hourlyRatePesos)}</strong><div data-color-mode="light" className="service-markdown"><MDEditor.Markdown source={version.description || "No description yet."} rehypePlugins={[rehypeSanitize]} disableCopy components={{ a: ({ children }) => <span>{children}</span> }} /></div></div></div></main></div>
  </dialog>, document.body)
}

export function ServicesPanel() {
  const [rows, setRows] = useState<AdminService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [savingAction, setSavingAction] = useState<"draft" | "publish" | null>(null)
  const [tab, setTab] = useState("Services")
  const [editing, setEditing] = useState<Editing | null>(null)
  const [preview, setPreview] = useState<{ version: ServiceContent & { imageId: string | null; state: ServiceVersion["state"] }; imageSrc?: string } | null>(null)
  const [step, setStep] = useState(0)
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [formError, setFormError] = useState("")
  const [confirm, setConfirm] = useState<{ item: AdminService; action: "publish" | "archive" | "delete" } | null>(null)
  useEffect(() => {
    if (!editing?.file) { setFilePreview(null); return }
    const url = URL.createObjectURL(editing.file); setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [editing?.file])
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
      setFormError(""); setStep(0); setShowMarkdown(false); setEditing({ id, updatedAt: version.updatedAt, form: content(version), imageId: version.imageId, removeImage: false, file: null })
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  const save = async (publish = false) => {
    if (!editing) return
    setBusy(true); setSavingAction(publish ? "publish" : "draft"); setFormError("")
    let saved = false
    try {
      if (publish && !editing.form.name.trim()) { setStep(0); throw new Error("Enter a service name before publishing.") }
      if (publish && !editing.form.description.trim()) { setStep(0); throw new Error("Enter a description before publishing.") }
      if (editing.form.hourlyRatePesos != null && (!Number.isSafeInteger(editing.form.hourlyRatePesos) || editing.form.hourlyRatePesos <= 0)) throw new Error("Hourly rate must be a whole number greater than zero.")
      if (publish && !editing.file && (!editing.imageId || editing.removeImage)) { setStep(1); throw new Error("Add a service image before publishing.") }
      if (publish && editing.form.hourlyRatePesos == null) throw new Error("Enter an hourly rate before publishing.")
      if (editing.file && (!["image/jpeg", "image/png", "image/webp"].includes(editing.file.type) || editing.file.size > MAX_IMAGE_SIZE_BYTES)) throw new Error("Choose a JPEG, PNG, or WebP image no larger than 10 MiB.")
      const form = editing.form
      let result: AdminService
      if (editing.file) {
        result = await uploadService(form, editing.file, editing.id || undefined, editing.updatedAt || undefined)
      } else if (editing.id && editing.updatedAt) result = await updateServiceDraft(editing.id, form, editing.updatedAt, editing.removeImage)
      else result = await createService(form)
      if (!result.draft) throw new Error("The saved service did not return a draft. Refresh the service list before trying again.")
      saved = true
      setEditing({ id: result.id, updatedAt: result.draft.updatedAt, form: content(result.draft), imageId: result.draft.imageId, removeImage: false, file: null })
      if (publish) await publishService(result.id, result.draft.updatedAt)
      setEditing(null); setNotice(publish ? "Service published." : "Service draft saved."); await load()
    } catch (err) {
      const detail = err instanceof ApiError && err.status === 409 ? `${errorMessage(err)} This service changed. Close and reopen it to load the latest details.` : err instanceof ApiError && err.status === 401 ? "Your session expired. Sign in again, then retry." : errorMessage(err)
      setFormError(saved ? `Draft saved, but publishing failed: ${detail}` : detail)
    } finally { setBusy(false); setSavingAction(null) }
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
  const field = <K extends keyof ServiceContent>(key: K, value: ServiceContent[K]) => { setFormError(""); setEditing(current => current ? { ...current, form: { ...current.form, [key]: value } } : current) }
  const visible = rows.filter(item => tab === "Archives" ? !!item.archivedAt : !item.archivedAt)
  return <div className="service-panel">
    <div className="service-panel-heading"><div><h1>Services</h1><p>Create services to include in packages or offer as add-ons.</p></div>{tab === "Services" && <Button disabled={busy} onClick={() => { setFormError(""); setStep(0); setShowMarkdown(false); setEditing({ id: null, updatedAt: null, form: { ...empty }, imageId: null, removeImage: false, file: null }) }}>Create service</Button>}</div>
    <Tabs className="package-tabs" active={tab} onChange={setTab} items={[{ value: "Services", label: "Services", count: rows.filter(item => !item.archivedAt).length }, { value: "Archives", label: "Archives", count: rows.filter(item => item.archivedAt).length }]} />
    {loading && <p role="status">Loading services…</p>}{error && <p role="alert">{error} <button onClick={() => void load()}>Try again</button></p>}{notice && <p role="status">{notice}</p>}
    {!loading && !error && visible.length === 0 && <p>{tab === "Archives" ? "No archived services found." : "No services yet. Create a draft to get started."}</p>}
    <div className="service-grid">{visible.map(item => { const version = item.draft || item.published; if (!version) return null; return <article className="admin-package-card" key={item.id}>
      <div className="admin-package-image service-card-image">{version.imageId && <img src={serviceImageSrc(version.imageId)} alt="" />}<Badge tone={item.archivedAt ? "neutral" : item.draft ? "warning" : "success"}>{item.archivedAt ? "Archived" : item.draft ? item.published ? "Draft changes" : "Draft" : "Published"}</Badge></div>
      <div className="admin-package-body service-card-body"><span className="package-kind">{rateLabel(version.hourlyRatePesos)}</span><h3 className="card-title">{version.name || "Untitled service"}</h3><button type="button" className="service-preview-trigger" onClick={() => setPreview({ version })}>View details</button>
      <div className="service-card-actions">{!item.archivedAt && <Button disabled={busy} onClick={() => void openEdit(item.id)}>Edit draft</Button>}{item.draft && !item.archivedAt && <Button disabled={busy} onClick={() => setConfirm({ item, action: "publish" })}>Publish draft</Button>}{item.published && !item.archivedAt && <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ item, action: "archive" })}>Archive</Button>}{!item.published && !item.archivedAt && <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ item, action: "delete" })}>Delete</Button>}</div></div>
    </article> })}</div>
    {preview && <ServicePreview version={preview.version} imageSrc={preview.imageSrc} onClose={() => setPreview(null)} />}
    {editing && <Dialog className="package-wizard service-wizard" title={editing.id ? "Edit service draft" : "Create service"} eyebrow="Service catalog" onClose={() => { if (!busy && window.confirm("Discard unsaved changes?")) setEditing(null) }} actions={<>
      {formError && step === 2 && <p className="service-save-feedback" role="alert">{formError}</p>}
      {savingAction && <p className="service-save-progress" role="status">{savingAction === "draft" ? "Saving draft…" : "Saving and publishing…"}</p>}
      <Button variant="secondary" disabled={busy} onClick={() => { if (step > 0) setStep(step - 1); else if (window.confirm("Discard unsaved changes?")) setEditing(null) }}>{step > 0 ? "Back" : "Cancel"}</Button>
      {step < 2 ? <Button disabled={busy} onClick={() => setStep(step + 1)}>Continue</Button> : <><Button variant="secondary" disabled={busy} onClick={() => setPreview({ version: { ...editing.form, imageId: editing.removeImage ? null : editing.imageId, state: "draft" }, imageSrc: filePreview || undefined })}>Preview</Button><Button variant="secondary" disabled={busy} onClick={() => void save()}>{savingAction === "draft" ? "Saving draft…" : "Save draft"}</Button><Button disabled={busy} onClick={() => void save(true)}>{savingAction === "publish" ? "Saving and publishing…" : "Save and publish"}</Button></>}
    </>}>
      <div className="package-steps" aria-label="Service editor steps">{["Details", "Image", "Rate"].map((name, index) => <button type="button" key={name} className={step === index ? "active" : ""} aria-current={step === index ? "step" : undefined} disabled={busy} onClick={() => { setFormError(""); setStep(index) }}><span>{index + 1}</span>{name}</button>)}</div>
      {formError && step < 2 && <p className="service-step-feedback" role="alert">{formError}</p>}
      {step === 0 && <div className="form-grid"><FormField className="full" label="Service name *"><input value={editing.form.name} onChange={e => field("name", e.target.value)} /></FormField><div className="full service-editor" data-color-mode="light"><label>Description *</label><MDEditor value={editing.form.description} onChange={value => field("description", value || "")} preview="edit" extraCommands={[]} textareaProps={{ "aria-label": "Description" }} /><label className="service-markdown-toggle"><input type="checkbox" checked={showMarkdown} onChange={e => setShowMarkdown(e.target.checked)} /> Preview description markdown</label><div className="service-editor-preview">{showMarkdown && <MDEditor.Markdown source={editing.form.description || "Nothing to preview yet."} rehypePlugins={[rehypeSanitize]} disableCopy components={{ a: ({ children }) => <span>{children}</span> }} />}</div></div></div>}
      {step === 1 && <div className="form-grid"><FormField className="full" label="Service image"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0] || null; setFormError(""); setEditing(current => current ? { ...current, file } : current); e.target.value = "" }} /><small>JPEG, PNG, or WebP, up to 10 MiB. An image is required to publish.</small></FormField>{(filePreview || (!editing.removeImage && editing.imageId)) && <div className="full package-image-preview"><img src={filePreview || serviceImageSrc(editing.removeImage ? null : editing.imageId)} alt="Service preview" /><button type="button" onClick={() => { setFormError(""); setEditing({ ...editing, file: null, removeImage: true }) }}>Remove image</button></div>}</div>}
      {step === 2 && <div className="form-grid"><FormField className="full" label="Hourly rate (PHP)"><input type="number" min="1" step="1" value={editing.form.hourlyRatePesos ?? ""} onChange={e => field("hourlyRatePesos", e.target.value === "" ? null : Number(e.target.value))} /><small>Enter whole pesos. A rate is required to publish.</small></FormField></div>}
    </Dialog>}
    {confirm && <Dialog title={`${confirm.action === "publish" ? "Publish" : confirm.action === "archive" ? "Archive" : "Delete"} service?`} onClose={() => { if (!busy) setConfirm(null) }} actions={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button><Button disabled={busy} onClick={() => void act()}>{busy ? "Please wait…" : confirm.action === "publish" ? "Publish" : confirm.action === "archive" ? "Archive" : "Delete"}</Button></>}><p>{confirm.action === "publish" ? "The server will validate and publish this draft. Existing packages keep their selected service details." : confirm.action === "archive" ? "The service will no longer be available for new selections. Services used by published packages cannot be archived." : "This permanently removes the never-published draft."}</p></Dialog>}
  </div>
}
