import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { getIncludingPackages, getPackage, getPackages, getService, getServices, getVenues, packageImageSrc, serviceImageSrc, venueImageSrc } from "../lib/api"
import type { PublicPackage, PublicService, Venue } from "../lib/api"
import { PackagePreview, priceLabel } from "./app/PackagePreview"
import { photos } from "./app/data"

type Kind = "services" | "packages" | "venues"
type Preview = { kind: Kind; id: string } | null

function PackageCard({ item, onPreview }: { item: PublicPackage; onPreview: () => void }) {
  return <article className="catalog-card">
    <div className="catalog-card-image"><img src={packageImageSrc(item.imageUrl) || photos.dinner} alt="" loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = photos.dinner }} /></div>
    <div className="catalog-card-body"><span className="catalog-card-kicker">{item.eventTypes.join(" · ") || "Event package"}</span><h3>{item.name}</h3><p>{item.description}</p>
      <div className="catalog-card-meta"><span>{priceLabel(item.price)}</span><span>Up to {item.guestMax} guests</span></div>
      <button type="button" className="catalog-card-action" onClick={onPreview}>View package <span aria-hidden="true">↗</span></button>
    </div>
  </article>
}

function ServiceCard({ item, onPreview }: { item: PublicService; onPreview: () => void }) {
  return <article className="catalog-card">
    <div className="catalog-card-image">{item.imageUrl && <img src={serviceImageSrc(item.imageUrl)} alt="" loading="lazy" />}</div>
    <div className="catalog-card-body"><span className="catalog-card-kicker">{item.categories.join(" · ") || "Event service"}</span><h3>{item.name}</h3><p>{item.description}</p>
      <button type="button" className="catalog-card-action" onClick={onPreview}>View service <span aria-hidden="true">↗</span></button>
    </div>
  </article>
}

function VenueCard({ item, onPreview }: { item: Venue; onPreview: () => void }) {
  return <article className="catalog-card"><div className="catalog-card-image">{item.imageUrls[0] ? <img src={venueImageSrc(item.imageUrls[0])} alt="" loading="lazy" /> : <span className="venue-photo-fallback">No venue photos available</span>}</div><div className="catalog-card-body"><span className="catalog-card-kicker">{item.location}</span><h3>{item.name}</h3><p>{item.description}</p><button type="button" className="catalog-card-action" onClick={onPreview}>View venue <span aria-hidden="true">↗</span></button></div></article>
}

function VenuePreview({ item, onClose }: { item: Venue; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = "hidden"
    dialog?.querySelector<HTMLButtonElement>(".package-preview-close")?.focus()
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; trigger?.focus() }
  }, [])
  return createPortal(<dialog ref={dialogRef} className="package-preview" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="package-preview-bar"><button type="button" className="package-preview-close" aria-label="Close venue preview" onClick={onClose}>×</button><span className="package-preview-brand">Clemora</span><span className="package-preview-divider" aria-hidden="true" /><span className="package-preview-label">Venue preview</span></header>
    <div className="package-preview-scroll"><main className="package-preview-main"><div className="package-preview-intro"><span className="package-preview-overline">{item.location}</span><h1 id={titleId}>{item.name}</h1><p>{item.description}</p>{item.categories.length > 0 && <p>{item.categories.join(" · ")}</p>}{item.capacityMax != null && <p>Up to {item.capacityMax} guests</p>}{item.imageUrls.length ? <div className="venue-photo-list">{item.imageUrls.map((url, index) => <img key={`${url}-${index}`} src={venueImageSrc(url)} alt={`${item.name} photo ${index + 1}`} />)}</div> : <p>No venue photos available.</p>}</div></main></div>
  </dialog>, document.body)
}

function ServicePreview({ id, onClose, onPackage }: { id: string; onClose: () => void; onPackage: (id: string) => void }) {
  const [service, setService] = useState<PublicService | null>(null)
  const [packages, setPackages] = useState<PublicPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    let active = true
    Promise.all([getService(id), getIncludingPackages(id)])
      .then(([detail, related]) => { if (active) { setService(detail); setPackages(related.packages) } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load service.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = "hidden"
    dialog?.querySelector<HTMLButtonElement>(".package-preview-close")?.focus()
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; trigger?.focus() }
  }, [])

  return createPortal(<dialog ref={dialogRef} className="package-preview service-preview" aria-labelledby={service ? titleId : undefined} aria-label={service ? undefined : "Service preview"} onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="package-preview-bar"><button type="button" className="package-preview-close" aria-label="Close service preview" onClick={onClose}>×</button><span className="package-preview-brand">Clemora</span><span className="package-preview-divider" aria-hidden="true" /><span className="package-preview-label">Service preview</span></header>
    <div className="package-preview-scroll">
      {loading && <p className="package-preview-state" role="status">Loading service…</p>}
      {error && <p className="package-preview-state" role="alert">{error}</p>}
      {service && <main className="package-preview-main">
        <div className="package-preview-topline"><span>Event service</span><span>Clemora collection</span></div>
        <div className="service-preview-hero"><div className="service-preview-image">{service.imageUrl && <img src={serviceImageSrc(service.imageUrl)} alt="" />}</div><div className="service-preview-summary"><span className="package-preview-overline">The detail</span><h1 id={titleId}>{service.name}</h1><p>{service.description}</p><div className="package-preview-types">{service.categories.map(category => <span key={category}>{category}</span>)}</div></div></div>
        <section className="service-preview-related" aria-labelledby="service-packages-heading"><span className="package-preview-overline">Explore the experience</span><h2 id="service-packages-heading">Packages that include this service</h2>
          {packages.length ? <div className="service-preview-package-list">{packages.map(item => <article key={item.id} className="service-preview-package"><div><h3>{item.name}</h3><p>Up to {item.guestMax} guests · {priceLabel(item.price)}</p></div><button type="button" onClick={() => onPackage(item.id)}>View package <span aria-hidden="true">↗</span></button></article>)}</div> : <p className="service-preview-empty">No current package includes this service. It may be available as an optional extra; check each package for its offered add-ons.</p>}
        </section>
      </main>}
    </div>
  </dialog>, document.body)
}

function CatalogPreview({ selected, venue, onClose, onPackage, allowBooking }: { selected: Preview; venue: Venue | undefined; onClose: () => void; onPackage: (id: string) => void; allowBooking: boolean }) {
  const [packageDetail, setPackageDetail] = useState<PublicPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    if (selected?.kind !== "packages") return
    let active = true
    setPackageDetail(null); setLoading(true); setError("")
    getPackage(selected.id).then(detail => { if (active) setPackageDetail(detail) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load package.") }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selected])
  if (selected?.kind === "venues" && venue) return <VenuePreview item={venue} onClose={onClose} />
  if (selected?.kind === "services") return <ServicePreview id={selected.id} onClose={onClose} onPackage={onPackage} />
  if (selected?.kind === "packages") return <PackagePreview allowBooking={allowBooking} item={packageDetail} loading={loading} error={error} onClose={onClose} />
  return null
}

export function PublicCatalog({ kind, mode = "featured", allowBooking = true, onViewMore }: { kind: Kind; mode?: "featured" | "overview"; allowBooking?: boolean; onViewMore?: () => void }) {
  const [items, setItems] = useState<(PublicPackage | PublicService | Venue)[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [initialized, setInitialized] = useState(false)
  const [selected, setSelected] = useState<Preview>(null)
  const [parentService, setParentService] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const limit = mode === "featured" ? 3 : 15

  const load = useCallback(async (offset: number, reset = false) => {
    if (busy.current) return
    busy.current = true
    setLoading(true); setError("")
    try {
      if (kind === "packages") {
        const result = await getPackages({ limit, offset })
        setItems(previous => reset ? result.packages : [...previous, ...result.packages])
        setNextOffset(result.nextOffset)
      } else if (kind === "venues") {
        const result = await getVenues({ limit, offset })
        setItems(previous => reset ? result.venues : [...previous, ...result.venues])
        setNextOffset(result.nextOffset)
      } else {
        const result = await getServices({ limit, offset })
        setItems(previous => reset ? result.services : [...previous, ...result.services])
        setNextOffset(result.nextOffset)
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Unable to load ${kind}.`) }
    finally { busy.current = false; setLoading(false); setInitialized(true) }
  }, [kind, limit])

  useEffect(() => { void load(0, true) }, [load])
  useEffect(() => {
    if (mode !== "overview" || nextOffset === null || loading || error) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load(nextOffset) } }, { rootMargin: "450px 0px" })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [mode, nextOffset, loading, error, load])

  const showPackage = (id: string) => { if (selected?.kind === "services") setParentService(selected.id); setSelected({ kind: "packages", id }) }
  const closePreview = () => { if (selected?.kind === "packages" && parentService) { setSelected({ kind: "services", id: parentService }); setParentService(null) } else setSelected(null) }

  return <>
    {!initialized && <p className="catalog-status" role="status">Loading {kind}…</p>}
    {initialized && items.length === 0 && !error && <p className="catalog-status">{kind === "packages" ? "No packages are published yet." : kind === "venues" ? "No venues are available yet." : "Our service catalog is being prepared. Please check back soon."}</p>}
    {items.length > 0 && <div className="catalog-grid">{kind === "packages" ? (items as PublicPackage[]).map(item => <PackageCard key={item.id} item={item} onPreview={() => showPackage(item.id)} />) : kind === "venues" ? (items as Venue[]).map(item => <VenueCard key={item.id} item={item} onPreview={() => setSelected({ kind: "venues", id: item.id })} />) : (items as PublicService[]).map(item => <ServiceCard key={item.id} item={item} onPreview={() => setSelected({ kind: "services", id: item.id })} />)}</div>}
    {error && <p className="catalog-status" role="alert">{error} <button type="button" onClick={() => void load(items.length ? nextOffset ?? items.length : 0, items.length === 0)}>Try again</button></p>}
    {mode === "featured" && onViewMore && <button type="button" className="catalog-view-more" onClick={onViewMore}>View more {kind}<span aria-hidden="true">↗</span></button>}
    {mode === "overview" && <div className="catalog-pagination"><div ref={sentinelRef} aria-hidden="true" />{loading && initialized && <p role="status">Loading more {kind}…</p>}{nextOffset !== null && !loading && !error && <button type="button" onClick={() => void load(nextOffset)}>Load more {kind}</button>}{initialized && nextOffset === null && items.length > 0 && <p>All {items.length} {kind} shown</p>}</div>}
    <CatalogPreview allowBooking={allowBooking} selected={selected} venue={selected?.kind === "venues" ? (items as Venue[]).find(item => item.id === selected.id) : undefined} onClose={closePreview} onPackage={showPackage} />
  </>
}

export function CatalogOverlay({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = "hidden"
    dialog?.querySelector<HTMLButtonElement>(".package-preview-close")?.focus()
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; trigger?.focus() }
  }, [])

  return createPortal(<dialog ref={dialogRef} className="package-preview catalog-overlay" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="package-preview-bar"><button type="button" className="package-preview-close" aria-label="Close catalog" onClick={onClose}>×</button><span className="package-preview-brand">Clemora</span><span className="package-preview-divider" aria-hidden="true" /><span className="package-preview-label">The collection</span></header>
    <div className="package-preview-scroll"><main className="catalog-overlay-main"><span className="package-preview-overline">The Clemora collection</span><h1 id={titleId}>All {kind}</h1><p>Explore {kind} for your gathering.</p><PublicCatalog kind={kind} mode="overview" /></main></div>
  </dialog>, document.body)
}
