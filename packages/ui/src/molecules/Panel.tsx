import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  action,
  header,
  children,
  className = "",
  headClassName = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  header?: ReactNode;
  children?: ReactNode;
  className?: string;
  headClassName?: string;
}) {
  const hasHeader =
    header !== undefined ||
    title !== undefined ||
    description !== undefined ||
    action !== undefined;

  return (
    <div className={`panel${className ? ` ${className}` : ""}`}>
      {hasHeader && (
        <div className={`panel-head${headClassName ? ` ${headClassName}` : ""}`}>
          {header ?? (
            <div>
              {title !== undefined && <div className="panel-title">{title}</div>}
              {description !== undefined && <p>{description}</p>}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
