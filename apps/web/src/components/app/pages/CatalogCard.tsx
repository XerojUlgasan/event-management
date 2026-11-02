import type { ReactNode } from "react"

type CardStatus = { label: string; tone: "neutral" | "warning" | "success" }
type CardAction = { label: string; onSelect: () => void }

export function CatalogCard({ image, imageFallback, eyebrow, title, description, metadata, action }: {
  image?: string
  imageFallback?: string
  eyebrow: string
  title: string
  description: string
  metadata: { label: string; value: ReactNode }[]
  action?: ReactNode
}) {
  return <article className="pe-card">
    {image ? <img src={image} alt="" /> : <div className="pe-card-image-placeholder">{imageFallback}</div>}
    <div className="pe-card-body"><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p>
      <div className="pe-card-meta">{metadata.map(item => <div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</div>
      {action}
    </div>
  </article>
}

export function CatalogCardActions({ name, status, actions = [], onEdit, disabled = false }: {
  name: string
  status: CardStatus
  actions?: CardAction[]
  onEdit?: () => void
  disabled?: boolean
}) {
  return <div className="pe-card-actions">
    <span className="pe-status" data-tone={status.tone}>{status.label === "Published" ? "●  Published" : status.label}</span>
    {actions.length > 0 && <details className="pe-actions-menu"><summary aria-label={`More actions for ${name}`} aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault() }}>⋯</summary><div>{actions.map(action => <button key={action.label} disabled={disabled} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); action.onSelect() }}>{action.label}</button>)}</div></details>}
    {onEdit && <button disabled={disabled} onClick={onEdit}>Edit ↗</button>}
  </div>
}
