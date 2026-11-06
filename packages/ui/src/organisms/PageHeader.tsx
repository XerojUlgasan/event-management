import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  titleAs: Title = "h1",
  description,
  actions,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleAs?: "h1" | "h2" | "h3";
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`page-head${className ? ` ${className}` : ""}`}>
      <div>
        {eyebrow !== undefined && <span className="eyebrow">{eyebrow}</span>}
        <Title className="page-title">{title}</Title>
        {description !== undefined && <p>{description}</p>}
      </div>
      {actions}
    </div>
  );
}
