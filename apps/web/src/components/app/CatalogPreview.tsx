import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import type { ServiceContent, VenueContent } from "../../lib/api"
import { serviceImageSrc, venueImageSrc } from "../../lib/api"
import MarkdownPreview from "@uiw/react-markdown-preview"
import rehypeSanitize from "rehype-sanitize"
import { CatalogSections } from "./CatalogSections"

export const serviceRateLabel = (rate: number | null) => rate == null ? "Rate not set" : `${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(rate)} / hour`

export function ServiceCanvas({ item }: { item: ServiceContent & { imageId?: string | null } }) {
  const hasPhoto = item.sections.some(section => section.widgets.some(widget => widget.type === "photo" && widget.media))
  return <main className="package-canvas-preview"><div className="canvas-intro"><h1>{item.name || "Untitled service"}</h1><div className="catalog-summary"><MarkdownPreview source={item.description} rehypePlugins={[rehypeSanitize]} /></div><div><strong>{serviceRateLabel(item.hourlyRatePesos)}</strong></div></div>{!hasPhoto && item.imageId && <img className="catalog-legacy-image" src={serviceImageSrc(item.imageId)} alt="" />}<CatalogSections sections={item.sections} /></main>
}
export function VenueCanvas({ item }: { item: VenueContent }) {
  return <main className="package-canvas-preview"><div className="canvas-intro"><h1>{item.name || "Untitled venue"}</h1><p>{item.location}</p><p>{item.description}</p>{item.categories.length > 0 && <p>{item.categories.join(" · ")}</p>}{item.capacityMax != null && <div><strong>Up to {item.capacityMax} guests</strong></div>}</div><CatalogSections sections={item.sections} />{item.imageUrls.length > 0 && <div className="venue-photo-list">{item.imageUrls.map((url, index) => <img key={`${url}-${index}`} src={venueImageSrc(url)} alt={`${item.name} photo ${index + 1}`} />)}</div>}</main>
}
export function CatalogDetailPreview({ entity, children, onClose }: { entity: "service" | "venue"; children: ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const title = `${entity[0].toUpperCase()}${entity.slice(1)} preview`
  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = "hidden"
    dialog?.querySelector<HTMLButtonElement>("button")?.focus()
    return () => { dialog?.close(); document.body.style.overflow = overflow; trigger?.focus() }
  }, [])
  return createPortal(<dialog ref={dialogRef} className="package-preview" aria-label={title} onCancel={event => { event.preventDefault(); onClose() }}><header className="package-preview-bar"><button type="button" className="package-preview-close" aria-label={`Close ${entity} preview`} onClick={onClose}>×</button><span className="package-preview-brand">Clemora</span><span className="package-preview-divider" /><span className="package-preview-label">{title}</span></header><div className="package-preview-scroll">{children}</div></dialog>, document.body)
}
