import { Button, Icon, Input, NativeDialog } from "@event-management/ui"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog"
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images"
import { MAX_VIDEO_SIZE_BYTES } from "@event-management/contracts/limits/videos"
import type { CatalogWidget } from "../../../lib/api"
import { WidgetContent } from "../CatalogSections"

export function PackageMediaSettings({ widget, fileName, onChange, onSelectFile, onClose, entity = "package" }: {
  entity?: "package" | "service" | "venue"
  widget: CatalogWidget
  fileName?: string
  onChange: (patch: Partial<CatalogWidget>) => void
  onSelectFile: (file?: File) => string | undefined
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState("")
  const isPhoto = widget.type === "photo"
  const title = isPhoto ? "Photo settings" : "Video settings"
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const node = dialog.current
    node?.showModal()
    return () => { node?.close(); trigger?.focus() }
  }, [])

  return createPortal(<NativeDialog ref={dialog} className="pe-media-dialog" aria-label={title} onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}>
    <header><h2>{title}</h2><Button variant="plain" type="button" className="pe-media-close" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><Icon name="close" size={20} strokeWidth="1.5" /></Button></header>
    <div className="pe-media-dialog-body">
      <div className="pe-media-settings-preview"><WidgetContent widget={widget} editor /></div>
      <label>Upload {isPhoto ? "photo" : "video"}<Input variant="plain" type="file" accept={isPhoto ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm"} onChange={event => setError(onSelectFile(event.target.files?.[0]) || "")} /><small>{isPhoto ? "JPEG, PNG, or WebP" : "MP4 or WebM"} · Maximum {Math.floor((isPhoto ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES) / 1024 / 1024)} MiB{fileName && <span className="pe-media-filename">Selected: {fileName}</span>}</small></label>
      {error && <p className="pe-media-error" role="alert">{error}</p>}
      {isPhoto && <label>Image description<Input maxLength={MAX_CATALOG_TEXT_LENGTH} value={widget.alt} onChange={event => onChange({ alt: event.target.value })} /><small>Describe the image for people using screen readers.</small></label>}
      <label>Caption<Input maxLength={MAX_CATALOG_TEXT_LENGTH} value={widget.caption} onChange={event => onChange({ caption: event.target.value })} /></label>
      {!isPhoto && <label className="pe-autoplay-option"><Input variant="plain" type="checkbox" checked={widget.autoplay} onChange={event => onChange({ autoplay: event.target.checked })} /><span>Autoplay for customers<small>Starts muted. Customers can unmute or pause the video.</small></span></label>}
    </div>
    <footer><p>Changes apply when you save the {entity}.</p><Button type="button" onClick={onClose}>Done</Button></footer>
  </NativeDialog>, document.body)
}
