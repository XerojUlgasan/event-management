import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "page-head",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div>
        {eyebrow !== undefined && <span className="eyebrow">{eyebrow}</span>}
        <div className="page-title">{title}</div>
        {description !== undefined && <p>{description}</p>}
      </div>
      {actions}
    </div>
  );
}
