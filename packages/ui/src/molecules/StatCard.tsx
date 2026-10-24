import { Badge } from "../atoms/Badge";

export function StatCard({
  label,
  value,
  change,
  detail,
  tone = "",
}: {
  label: string
  value: string
  change?: string
  detail: string
  tone?: string
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-label">
        {label}
        <button type="button" aria-label={`More about ${label}`}>•••</button>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">
        {change && <Badge tone="success">{change}</Badge>}
        <span>{detail}</span>
      </div>
    </div>
  )
}
