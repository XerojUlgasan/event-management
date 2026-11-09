import { Button, NativeDialog } from "@event-management/ui"
import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import type { ServiceContent } from "../../lib/data/services"
import type { VenueContent } from "../../lib/data/venues"
import MarkdownPreview from "@uiw/react-markdown-preview"
import rehypeSanitize from "rehype-sanitize"
import { CatalogSections } from "./CatalogSections"

export const serviceRateLabel = (rate: number | null) => rate == null ? "Rate not set" : `${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(rate)} / hour`

export function ServiceCanvas({ item }: { item: ServiceContent }) {
  return <main className="package-canvas-preview"><div className="canvas-intro"><h1>{item.name || "Untitled service"}</h1><div className="catalog-summary"><MarkdownPreview source={item.description} rehypePlugins={[rehypeSanitize]} /></div><div><strong>{serviceRateLabel(item.hourlyRatePesos)}</strong></div></div><CatalogSections sections={item.sections} /></main>
}
export function VenueCanvas({ item }: { item: VenueContent }) {
  return <main className="package-canvas-preview"><div className="canvas-intro"><h1>{item.name || "Untitled venue"}</h1><p>{item.location}</p><p>{item.description}</p>{item.maxGuests != null && <div><strong>Up to {item.maxGuests} guests</strong></div>}</div><CatalogSections sections={item.sections} /></main>
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
  return createPortal(<NativeDialog ref={dialogRef} className="package-preview" aria-label={title} onCancel={event => { event.preventDefault(); onClose() }}><header className="package-preview-bar"><Button variant="plain" type="button" className="package-preview-close" aria-label={`Close ${entity} preview`} onClick={onClose}>×</Button><span className="package-preview-brand">Clemora</span><span className="package-preview-divider" /><span className="package-preview-label">{title}</span></header><div className="package-preview-scroll">{children}</div></NativeDialog>, document.body)
}
