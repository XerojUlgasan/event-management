import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Panel({
  title,
  description,
  action,
  header,
  children,
  className = "",
  headClassName = "",
  as: Component = "div",
  ...props
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  header?: ReactNode;
  children?: ReactNode;
  className?: string;
  headClassName?: string;
  as?: "div" | "section" | "article";
} & Omit<ComponentPropsWithoutRef<"div">, "title">) {
  const hasHeader =
    header !== undefined ||
    title !== undefined ||
    description !== undefined ||
    action !== undefined;

  return (
    <Component
      {...props}
      className={`panel${className ? ` ${className}` : ""}`}
    >
      {hasHeader && (
        <div
          className={`panel-head${headClassName ? ` ${headClassName}` : ""}`}
        >
          {header ?? (
            <div>
              {title !== undefined && (
                <div className="panel-title">{title}</div>
              )}
              {description !== undefined && <p>{description}</p>}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </Component>
  );
}
