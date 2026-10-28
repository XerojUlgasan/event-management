import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { serviceImageSrc } from "../../lib/api"
import type { PackageContent, PackagePrice, PackageService, PackageVersion } from "../../lib/api"
import { packageImageSrc } from "../../lib/api"
import { BookingRequestDialog } from "./BookingRequest"
import type { PublicPackage } from "../../lib/api"
import { photos } from "./data"

export function priceLabel(price: PackagePrice | null) {
  if (!price) return "Price on request"
  try {
    const format = new Intl.NumberFormat("en-PH", { style: "currency", currency: price.currency })
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2
    return `${format.format(price.amountMinor / 10 ** digits)} total`
  } catch {
    return `${price.currency} ${price.amountMinor} centavos total`
  }
}

export function PackagePreview({ item, loading = false, error = "", versionState, onClose }: {
  item: PackageContent | null
  loading?: boolean
  error?: string
  versionState?: PackageVersion["state"]
  onClose: () => void
}) {
  const [booking, setBooking] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const admin = !!versionState
  const services = (item?.services || []).filter((entry): entry is PackageService => "service" in entry && !!entry.service)
  const includedServices = services.filter(entry => entry.role === "included")
  const addOns = services.filter(entry => entry.role === "add_on")
  const previewStateLabel = versionState === "draft" ? "Draft preview" : versionState === "published" ? "Published preview" : versionState ? "Superseded preview" : ""

  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = "hidden"
    dialog?.querySelector<HTMLButtonElement>(".package-preview-close")?.focus()
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!booking && dialog && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLButtonElement>(".booking-start")?.focus()
    }
  }, [booking])

  return createPortal(
    <dialog ref={dialogRef} className="package-preview" aria-labelledby={item ? titleId : undefined} aria-label={item ? undefined : "Package preview"} onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="package-preview-bar">
        <button type="button" className="package-preview-close" onClick={onClose} aria-label="Close package preview">×</button>
        <span className="package-preview-brand">Clemora</span>
        <span className="package-preview-divider" aria-hidden="true" />
        <span className="package-preview-label">Package preview</span>
        {admin && <span className="package-preview-admin">{previewStateLabel}</span>}
      </header>
      <div className="package-preview-scroll">
        {loading && <p className="package-preview-state" role="status">Loading package…</p>}
        {error && <p className="package-preview-state" role="alert">{error}</p>}
        {item && <main className="package-preview-main">
          <div className="package-preview-topline"><span>Event package</span><span>{admin ? previewStateLabel : "Clemora collection"}</span></div>
          <div className="package-preview-hero">
            <img src={packageImageSrc(item.imageUrl) || photos.dinner} alt="" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = photos.dinner }} />
            <aside className="package-preview-summary" aria-label="Package summary">
              <span className="package-preview-overline">The experience</span>
              <strong className="package-preview-summary-title">At a glance</strong>
              <p>{item.description || "Add a description to introduce this package."}</p>
              <div className="package-preview-summary-data">
                <div><span>Package total</span><strong>{priceLabel(item.price)}</strong></div>
                <div><span>Estimated guest range</span><strong>{item.guestMin}–{item.guestMax} guests</strong></div>
              </div>
              <p className="package-preview-note">{admin ? "This preview does not publish the package." : "Your preferred date and final price are subject to staff review."}</p>
            {!admin && "versionId" in item && <button className="booking-start" type="button" onClick={() => { dialogRef.current?.close(); setBooking(true) }}>Book now</button>}
            </aside>
          </div>
          <div className="package-preview-content">
            <div className="package-preview-intro">
              <span className="package-preview-overline">Package overview</span>
              <h1 id={titleId}>{item.name || "Untitled package"}</h1>
              {item.eventTypes.length > 0 && <div className="package-preview-types">{item.eventTypes.map(type => <span key={type}>{type}</span>)}</div>}
              <p>{item.description || "No description yet."}</p>
            </div>
            <div className="package-preview-sections">
              <section>
                <span className="package-preview-overline">01 / The details</span>
                <h2>What’s included</h2>
                {item.inclusions.length || includedServices.length ? <ul className="package-preview-inclusions">{item.inclusions.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}{includedServices.map(entry => <li key={entry.id}><strong>{entry.service.name}</strong><br />{entry.includedQuantity} included{entry.service.imageUrl && <img className="package-preview-service-image" src={serviceImageSrc(entry.service.imageUrl)} alt="" />}{entry.service.categories.length > 0 && <><br />{entry.service.categories.join(", ")}</>}{entry.service.description && <><br />{entry.service.description}</>}</li>)}</ul> : <p>No inclusions specified yet.</p>}
              </section>
              {addOns.length > 0 && <section><span className="package-preview-overline">Optional / Additional cost</span><h2>Optional add-ons</h2><ul className="package-preview-inclusions">{addOns.map(entry => <li key={entry.id}><strong>{entry.service.name}</strong><br />{entry.addOnPrice ? `${priceLabel(entry.addOnPrice).replace(/ total$/, "")} per unit` : "Price unavailable"} · up to {entry.addOnMaxQuantity}{entry.service.imageUrl && <img className="package-preview-service-image" src={serviceImageSrc(entry.service.imageUrl)} alt="" />}{entry.service.categories.length > 0 && <><br />{entry.service.categories.join(", ")}</>}{entry.service.description && <><br />{entry.service.description}</>}</li>)}</ul></section>}
              <section>
                <span className="package-preview-overline">02 / The setting</span>
                <h2>Venue &amp; arrangements</h2>
                <p>{item.venueDetails || "Venue details have not been specified yet."}</p>
              </section>
              {item.exclusions.length > 0 && <section>
                <span className="package-preview-overline">03 / Good to know</span>
                <h2>Not included</h2>
                <ul className="package-preview-plain-list">{item.exclusions.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ul>
              </section>}
              <section>
                <span className="package-preview-overline">{item.exclusions.length > 0 ? "04" : "03"} / Before you plan</span>
                <h2>Terms</h2>
                <p>{item.terms || "Terms have not been specified yet."}</p>
              </section>
            </div>
          </div>
        </main>}
      </div>
      {booking && item && "versionId" in item && <BookingRequestDialog item={item as PublicPackage} onClose={() => setBooking(false)} />}
    </dialog>,
    document.body,
  )
}
