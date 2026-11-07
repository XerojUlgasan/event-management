import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { PackageContent, PackagePrice, PackageServiceView, PublicPackage } from "../../lib/api"
import { CatalogSections } from "./CatalogSections"
import { BookingRequestDialog } from "./BookingRequest"

export function priceLabel(price: PackagePrice | null) {
  return price ? `${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(price.amountMinor / 100)} total` : "Price on request"
}
type CanvasPackage = Omit<PackageContent, "services"> & { services?: PackageServiceView[] }
export function PackageCanvas({ item }: { item: CanvasPackage }) {
  const named = (role: "included" | "optional") => (item.services ?? []).filter(service => service.role === role && service.name)
  const included = named("included"), optional = named("optional")
  return <main className="package-canvas-preview"><div className="canvas-intro"><span>THE CLEMORA COLLECTION</span><h1>{item.name || "Untitled package"}</h1><div><strong>{priceLabel(item.price)}</strong><strong>Up to {item.maxGuests} guests</strong></div></div>{included.length > 0 && <section className="package-services"><h2>Included services</h2><ul>{included.map(service => <li key={service.serviceId}>{service.name}{service.archivedAt && <small> (no longer available)</small>}</li>)}</ul></section>}{optional.length > 0 && <section className="package-services"><h2>Optional services</h2><ul>{optional.map(service => <li key={service.serviceId}>{service.name}{service.archivedAt && <small> (no longer available)</small>}</li>)}</ul></section>}<CatalogSections sections={item.sections} /></main>
}
export function PackagePreview({ item, loading = false, error = "", onClose, allowBooking = true, returnFocus }: { item: PublicPackage | null; loading?: boolean; error?: string; allowBooking?: boolean; onClose: () => void; returnFocus?: HTMLElement | null }) {
  const [booking, setBooking] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null), titleId = useId()
  useEffect(() => { const trigger = returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null); const dialog = dialogRef.current; const overflow = document.body.style.overflow; dialog?.showModal(); document.body.style.overflow = "hidden"; return () => { dialog?.close(); document.body.style.overflow = overflow; trigger?.focus() } }, [])
  useEffect(() => { if (!booking && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal() }, [booking])
  return createPortal(<><dialog ref={dialogRef} className="package-preview" aria-label="Package preview" onCancel={e => { e.preventDefault(); onClose() }}><header className="package-preview-bar"><button className="package-preview-close" onClick={onClose} aria-label="Close package preview">×</button><span className="package-preview-brand">Clemora</span><span className="package-preview-divider" /><span className="package-preview-label" id={titleId}>Package preview</span>{item && allowBooking && <button className="booking-start canvas-book" onClick={() => { dialogRef.current?.close(); setBooking(true) }}>Book now</button>}</header><div className="package-preview-scroll">{loading && <p role="status">Loading package…</p>}{error && <p role="alert">{error}</p>}{item && <PackageCanvas item={item} />}</div></dialog>{booking && item && <BookingRequestDialog item={item} onClose={() => setBooking(false)} />}</>, document.body)
}
