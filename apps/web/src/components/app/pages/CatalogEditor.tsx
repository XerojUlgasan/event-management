import { Button, Icon, Input, NativeDialog, Select, useNotifications } from "@event-management/ui"
import { CATALOG_COLUMNS, MAX_CATALOG_SECTIONS, MAX_CATALOG_WIDGETS, MAX_WIDGET_MARKDOWN_LENGTH } from "@event-management/contracts/catalog"
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog"
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images"
import { MAX_VIDEO_SIZE_BYTES } from "@event-management/contracts/limits/videos"
import { useEffect, useRef, useState } from "react"
import type { Dispatch, ReactNode, SetStateAction } from "react"
import { createPortal } from "react-dom"
import GridLayout from "react-grid-layout/legacy"
import MDEditor from "@uiw/react-md-editor"
import rehypeSanitize from "rehype-sanitize"
import type { CatalogSection, CatalogWidget } from "@event-management/contracts/catalog"
import { deleteCatalogMedia } from "../../../lib/data/catalog-media"
import { unreferencedUploadIds, uploadPendingCatalogMedia } from "../../../lib/services/save-catalog-media"
import { WidgetContent } from "../CatalogSections"
import { PackageMediaSettings } from "./PackageMediaSettings"
import "react-grid-layout/css/styles.css"
import "../../../styles/package-editor.css"

const uuid = () => crypto.randomUUID()
export const newCatalogSection = (): CatalogSection => ({ id: uuid(), title: "", widgets: [] })
const newSection = newCatalogSection
const widget = (type: CatalogWidget["type"], y: number): CatalogWidget => ({ id: uuid(), type, x: 0, y, w: 6, h: 5, markdown: type === "markdown" ? "## Your heading\n\nTell your story here." : "", media: null, alt: "", caption: "", autoplay: false })
function MediaWidget({ widget, onSelectFile }: { widget: CatalogWidget; onSelectFile: (file?: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <div className="pe-media-preview">
    {widget.media?.url ? <WidgetContent widget={widget} editor /> : <Button variant="plain" type="button" className="canvas-empty pe-choose-media" onClick={() => inputRef.current?.click()}>Add a {widget.type === "photo" ? "photo" : "video"}</Button>}
    <Input variant="plain" ref={inputRef} type="file" hidden accept={widget.type === "photo" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm"} onChange={event => { onSelectFile(event.target.files?.[0]); event.currentTarget.value = "" }} />
  </div>
}
type CanvasContent = { name: string; sections: CatalogSection[] }
export function CatalogEditor<T extends CanvasContent>({ initial, entity, onClose, onSaved, onSave, validate, renderDetails, renderPreview, saveLabel = "Save changes", nameMaxLength = MAX_CATALOG_TEXT_LENGTH }: {
  initial: T
  entity: "package" | "service" | "venue"
  onClose: () => void
  onSaved: () => void
  onSave: (content: T) => Promise<void>
  validate?: (content: T) => string | undefined
  renderDetails: (content: T, setContent: Dispatch<SetStateAction<T>>) => ReactNode
  renderPreview: (content: T, mode: "customer" | "card") => ReactNode
  nameMaxLength?: number
  saveLabel?: string
}) {
  const { notify, notifyError } = useNotifications()
  const title = entity[0].toUpperCase() + entity.slice(1)
  const [content, setContent] = useState<T>(() => structuredClone(initial))
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [markdownPreview, setMarkdownPreview] = useState<Record<string, boolean>>({})
  const [targetSection, setTargetSection] = useState(0)
  const [settings, setSettings] = useState(false), [preview, setPreview] = useState(false), [mode, setMode] = useState<"customer" | "card">("customer"), [error, setError] = useState(""), [busy, setBusy] = useState(false)
  const [files, setFiles] = useState<Record<string, File>>({})
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({})
  const [mediaEditing, setMediaEditing] = useState<{ sectionId: string; widgetId: string } | null>(null)
  const displayContent = { ...content, sections: content.sections.map(s => ({ ...s, widgets: s.widgets.map(w => localUrls[w.id] && w.media ? { ...w, media: { ...w.media, url: localUrls[w.id] } } : w) })) }
  const editingMedia = mediaEditing && displayContent.sections.find(s => s.id === mediaEditing.sectionId)?.widgets.find(w => w.id === mediaEditing.widgetId)
  const pending = useRef<string[]>([]), objectUrls = useRef<string[]>([])
  const [width, setWidth] = useState(800), gridContainer = useRef<HTMLDivElement>(null)
  useEffect(() => { const node = gridContainer.current; if (!node) return; const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width)); observer.observe(node); return () => observer.disconnect() }, [preview])
  useEffect(() => () => { objectUrls.current.forEach(URL.revokeObjectURL) }, [])
  const setSection = (id: string, fn: (s: CatalogSection) => CatalogSection) => setContent(c => ({ ...c, sections: c.sections.map(s => s.id === id ? fn(s) : s) }))
  const changeWidget = (sid: string, id: string, patch: Partial<CatalogWidget>) => setSection(sid, s => ({ ...s, widgets: s.widgets.map(w => w.id === id ? { ...w, ...patch } : w) }))
  const keyboardLayout = (section: CatalogSection, current: CatalogWidget, event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return
    if (busy || width < 520 || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
    event.preventDefault()
    const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0
    const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0
    const next = event.shiftKey ? { ...current, w: current.w + dx, h: current.h + dy } : { ...current, x: current.x + dx, y: current.y + dy }
    if (next.x < 0 || next.y < 0 || next.w < 3 || next.h < 4 || next.x + next.w > CATALOG_COLUMNS) return
    if (section.widgets.some(other => other.id !== current.id && next.x < other.x + other.w && next.x + next.w > other.x && next.y < other.y + other.h && next.y + next.h > other.y)) return
    changeWidget(section.id, current.id, { x: next.x, y: next.y, w: next.w, h: next.h })
  }
  const reorderMobile = (section: CatalogSection, id: string, direction: number) => {
    const sorted = [...section.widgets].sort((a, b) => a.y - b.y || a.x - b.x)
    const index = sorted.findIndex(w => w.id === id), target = index + direction
    if (index < 0 || target < 0 || target >= sorted.length) return
    ;[sorted[index], sorted[target]] = [sorted[target], sorted[index]]
    let y = 0
    const widgets = sorted.map(w => { const next = { ...w, x: 0, y }; y += w.h; return next })
    setSection(section.id, s => ({ ...s, widgets }))
  }
  const selectFile = (sid: string, w: CatalogWidget, file?: File): string | undefined => { if (!file) return; const max = w.type === "photo" ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES; const types = w.type === "photo" ? ["image/jpeg", "image/png", "image/webp"] : ["video/mp4", "video/webm"]; if (!types.includes(file.type)) return w.type === "photo" ? "Choose a JPEG, PNG, or WebP image." : "Choose an MP4 or WebM video."; if (!file.size || file.size > max) return `File must be ${Math.floor(max / 1024 / 1024)} MiB or smaller.`; const url = URL.createObjectURL(file); objectUrls.current.push(url); setLocalUrls(f => ({ ...f, [w.id]: url })); setFiles(f => ({ ...f, [w.id]: file })); changeWidget(sid, w.id, { media: { kind: w.type === "photo" ? "image" : "video", source: "upload", url } }) }
  const cancel = () => { if (busy || !window.confirm("Discard unsaved changes?")) return; void Promise.allSettled(pending.current.map(deleteCatalogMedia)); onClose() }
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialogRef.current?.showModal()
    document.querySelector<HTMLInputElement>(".pe-name input")?.focus()
    return () => { dialogRef.current?.close(); document.body.style.overflow = previousOverflow; trigger?.focus() }
  }, [])
  useEffect(() => {
    const dialog = dialogRef.current
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length > 0)
      if (!controls.length) { event.preventDefault(); return }
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    dialog?.addEventListener("keydown", trap)
    return () => dialog?.removeEventListener("keydown", trap)
  }, [])
  const save = async () => {
    const validationError = validate?.(content)
    if (validationError) { setError(notifyError(validationError)); setSettings(true); return }
    setBusy(true); setError("")
    try {
      const next = await uploadPendingCatalogMedia(content, files, (widgetId, uploaded) => {
        if (uploaded.id) pending.current.push(uploaded.id)
        setContent(c => ({ ...c, sections: c.sections.map(s => ({ ...s, widgets: s.widgets.map(old => old.id === widgetId ? { ...old, media: uploaded } : old) })) }))
        setFiles(f => { const copy = { ...f }; delete copy[widgetId]; return copy })
      })
      await onSave(next)
      void Promise.allSettled(unreferencedUploadIds(next.sections, pending.current).map(deleteCatalogMedia))
      pending.current = []; notify(`${title} saved.`); onSaved()
    } catch (e) { setError(notifyError(e, "Something went wrong.")) } finally { setBusy(false) }
  }
  return createPortal(<NativeDialog ref={dialogRef} className="pe-overlay" aria-label={`${title} editor`} onCancel={event => { event.preventDefault(); if (settings) setSettings(false); else cancel() }}><fieldset disabled={busy} className="pe-editor-fields"><header className="pe-bar"><Button variant="plain" className="pe-back" onClick={cancel} aria-label={`Back to ${entity}s`}>←</Button><label className="pe-name"><small>{title.toUpperCase()} NAME</small><Input variant="plain" aria-label={`${title} name`} maxLength={nameMaxLength} value={content.name} placeholder={`Untitled ${entity}`} onChange={e => setContent({ ...content, name: e.target.value })} /></label><div className="pe-bar-actions"><Button variant="secondary" onClick={() => setSettings(!settings)} aria-expanded={settings}>⚙ &nbsp; {title} details</Button><Button variant="secondary" onClick={() => { setPreview(!preview); setSettings(false) }}>{preview ? "✎  Back to editor" : "◉  Preview"}</Button><Button variant="secondary" onClick={cancel} disabled={busy}>Cancel</Button><Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : saveLabel}</Button></div></header>
    {settings && <div className="pe-settings"><h2>{title} details</h2>{renderDetails(content, setContent)}<Button variant="secondary" onClick={() => setSettings(false)}>Done</Button></div>}
    {error && <p className="pe-error" role="alert">{error}</p>}
    {preview ? <div className="pe-preview-area"><div className="pe-preview-switch"><Button variant="secondary" aria-pressed={mode === "customer"} onClick={() => setMode("customer")}>Customer page</Button><Button variant="secondary" aria-pressed={mode === "card"} onClick={() => setMode("card")}>Admin card</Button></div>{renderPreview(displayContent, mode)}</div> : <div className="pe-workspace"><aside className="pe-sidebar"><small>BUILD YOUR PAGE</small><h2>Tell the story</h2><p>Arrange content to give clients a feel for this {entity}.</p><small>ADD A WIDGET</small>{content.sections.length > 1 && <label className="pe-target">Add to section<Select value={Math.min(targetSection, content.sections.length - 1)} onChange={e => setTargetSection(Number(e.target.value))}>{content.sections.map((s, i) => <option key={s.id} value={i}>{s.title || `Section ${i + 1}`}</option>)}</Select></label>}{(["photo", "markdown", "video"] as const).map(t => <Button variant="secondary" key={t} disabled={content.sections.reduce((n, s) => n + s.widgets.length, 0) >= MAX_CATALOG_WIDGETS} onClick={() => { const sid = content.sections[Math.min(targetSection, content.sections.length - 1)]?.id; if (sid) setSection(sid, s => ({ ...s, widgets: [...s.widgets, widget(t, Math.max(0, ...s.widgets.map(w => w.y + w.h)))] })) }}><b>{t === "photo" ? "▧" : t === "markdown" ? "T" : "▷"}</b><span><strong>{t === "markdown" ? "Markdown" : t[0].toUpperCase() + t.slice(1)}</strong><small>{t === "photo" ? "Set the scene" : t === "markdown" ? "Share the details" : "Bring it to life"}</small></span></Button>)}<p className="pe-tip"><strong>Make it yours.</strong><br />{width < 520 ? "Use the arrows to reorder. Open the editor on a wider screen to drag and resize widgets." : "Drag widgets by their header and resize from the corner. Widgets snap to the grid."}</p></aside><div className="pe-canvas-area" ref={gridContainer}><div className="pe-canvas-heading"><div><small>YOUR CANVAS</small><h2>{title} content</h2><p>Add, reorder, and resize your content.</p>{width < 520 && <p>Use the arrows to reorder. Drag and resize on a wider screen.</p>}</div><span>▦ &nbsp; 12-column layout · widgets snap to grid</span></div>
    {content.sections.map((section, index) => <section key={section.id} className="pe-editor-section"><div className="pe-section-bar"><Input variant="plain" aria-label={`Section ${index + 1} title`} maxLength={MAX_CATALOG_TEXT_LENGTH} placeholder={`Section ${index + 1} title (optional)`} value={section.title} onChange={e => setSection(section.id, s => ({ ...s, title: e.target.value }))} /><Button variant="secondary" disabled={index === 0} onClick={() => setContent(c => { const sections = [...c.sections]; [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]]; return { ...c, sections } })}>↑</Button><Button variant="secondary" disabled={index === content.sections.length - 1} onClick={() => setContent(c => { const sections = [...c.sections]; [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]]; return { ...c, sections } })}>↓</Button><Button variant="secondary" onClick={() => setContent(c => ({ ...c, sections: c.sections.filter(s => s.id !== section.id) }))} disabled={content.sections.length === 1}>Remove section</Button></div><div className="pe-grid"><GridLayout width={Math.max(0, width - 2)} cols={CATALOG_COLUMNS} isDraggable={!busy && width >= 520} isResizable={!busy && width >= 520} rowHeight={52} margin={[12, 12]} draggableHandle=".pe-widget-handle" draggableCancel="button, input, textarea, select, video" layout={width < 520 ? [...section.widgets].sort((a, b) => a.y - b.y || a.x - b.x).map((w, i, sorted) => ({ i: w.id, x: 0, y: sorted.slice(0, i).reduce((total, item) => total + item.h, 0), w: CATALOG_COLUMNS, h: w.h, minW: CATALOG_COLUMNS, maxW: CATALOG_COLUMNS, minH: 4 })) : section.widgets.map(w => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: 3, minH: 4 }))} onDragStop={layout => setSection(section.id, s => ({ ...s, widgets: s.widgets.map(w => ({ ...w, ...(({ x, y, w: width, h }) => ({ x, y, w: width, h }))(layout.find(l => l.i === w.id) || w) })) }))} onResizeStop={layout => setSection(section.id, s => ({ ...s, widgets: s.widgets.map(w => ({ ...w, ...(({ x, y, w: width, h }) => ({ x, y, w: width, h }))(layout.find(l => l.i === w.id) || w) })) }))}>{section.widgets.map(w => <div key={w.id} className={`pe-widget ${w.type === "markdown" ? "pe-markdown-widget" : "pe-media-widget"}`}><div className="pe-widget-handle" tabIndex={0} role="group" aria-label={width < 520 ? `${w.type} widget` : `${w.type} position. Use arrow keys to move, Shift and arrow keys to resize.`} onKeyDown={event => keyboardLayout(section, w, event)}><span>⠿ &nbsp; {w.type === "markdown" ? "Markdown" : w.type[0].toUpperCase() + w.type.slice(1)}</span>{width < 520 && <span className="pe-widget-order"><Button variant="secondary" type="button" aria-label={`Move ${w.type} up`} onClick={() => reorderMobile(section, w.id, -1)}>↑</Button><Button variant="secondary" type="button" aria-label={`Move ${w.type} down`} onClick={() => reorderMobile(section, w.id, 1)}>↓</Button></span>}{w.type !== "markdown" && <Button variant="plain" className="pe-widget-settings" type="button" aria-label={`${w.type === "photo" ? "Photo" : "Video"} settings`} aria-haspopup="dialog" onClick={() => setMediaEditing({ sectionId: section.id, widgetId: w.id })}><Icon name="more" size={20} /></Button>}{w.type === "markdown" && <Button variant="plain" className="pe-markdown-toggle" type="button" aria-pressed={!!markdownPreview[w.id]} onClick={() => setMarkdownPreview(v => ({ ...v, [w.id]: !v[w.id] }))}>{markdownPreview[w.id] ? "Edit Markdown" : "Preview Markdown"}</Button>}<Button variant="plain" aria-label={`Remove ${w.type}`} onClick={() => setSection(section.id, s => ({ ...s, widgets: s.widgets.filter(item => item.id !== w.id) }))}>×</Button></div><div className="pe-widget-body">{w.type === "markdown" ? <div className="pe-markdown-editor" data-color-mode="light"><MDEditor textareaProps={{ "aria-label": "Markdown content" }} value={w.markdown} onChange={value => changeWidget(section.id, w.id, { markdown: (value || "").slice(0, MAX_WIDGET_MARKDOWN_LENGTH) })} preview={markdownPreview[w.id] ? "preview" : "edit"} height="100%" minHeight={0} visibleDragbar={false} previewOptions={{ rehypePlugins: [rehypeSanitize] }} /></div> : <MediaWidget widget={displayContent.sections.find(s => s.id === section.id)?.widgets.find(item => item.id === w.id) || w} onSelectFile={file => { if (file) { const error = selectFile(section.id, w, file); setError(error || ""); if (error) notifyError(error) } }} />}</div></div>)}</GridLayout>{!section.widgets.length && <p className="pe-grid-empty">Add a widget to start building this section.</p>}</div></section>)}<Button variant="secondary" className="pe-add-section" disabled={content.sections.length >= MAX_CATALOG_SECTIONS} onClick={() => { setTargetSection(content.sections.length); setContent(c => ({ ...c, sections: [...c.sections, newSection()] })) }}>+ Add section</Button></div></div>}</fieldset>{mediaEditing && editingMedia && <PackageMediaSettings entity={entity} widget={editingMedia} fileName={files[editingMedia.id]?.name} onChange={patch => changeWidget(mediaEditing.sectionId, editingMedia.id, patch)} onSelectFile={file => selectFile(mediaEditing.sectionId, editingMedia, file)} onClose={() => setMediaEditing(null)} />}</NativeDialog>, document.body)
}
