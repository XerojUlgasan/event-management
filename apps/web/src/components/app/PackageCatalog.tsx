import { useEffect, useState } from "react"
import { Badge, Icon } from "@event-management/ui"
import { getPackage, getPackages, packageImageSrc } from "../../lib/api"
import type { PublicPackage } from "../../lib/api"
import { photos } from "./data"
import { PackagePreview, priceLabel } from "./PackagePreview"

export function PackageCatalog() {
  const [rows, setRows] = useState<PublicPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState<PublicPackage | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError("")
    getPackages().then(result => { if (active) setRows(result.packages) }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load packages.") }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])
  useEffect(() => {
    if (!selectedId) return
    let active = true
    setDetail(null); setDetailError(""); setDetailLoading(true)
    getPackage(selectedId).then(item => { if (active) setDetail(item) }).catch(err => { if (active) setDetailError(err instanceof Error ? err.message : "Unable to load package.") }).finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [selectedId])
  return <>
    {loading && <p>Loading packages…</p>}
    {error && <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Try again</button></p>}
    {!loading && !error && rows.length === 0 && <p>No packages are published yet.</p>}
    <div className="package-grid">{rows.map(item => <article className="package-card" key={item.id}>
      <div className="package-image"><img src={packageImageSrc(item.imageUrl) || photos.dinner} alt="" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = photos.dinner }} /><Badge tone="light">{item.guestMin}–{item.guestMax} guests</Badge></div>
      <div className="package-body"><div className="package-kind">{item.eventTypes.join(", ")}</div><div className="card-title">{item.name}</div><p>{item.description}</p>
        <div className="package-meta"><span>{priceLabel(item.price)}</span><span>{item.guestMin}–{item.guestMax} guests</span></div>
        <button className="card-link" onClick={() => { setDetail(null); setDetailError(""); setDetailLoading(true); setSelectedId(item.id) }}>View package <Icon name="arrow" size={16} /></button>
      </div>
    </article>)}</div>
    {selectedId && <PackagePreview item={detail} loading={detailLoading} error={detailError} onClose={() => setSelectedId(null)} />}
  </>
}
