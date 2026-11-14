import type { ReactNode } from "react";

export function ActionLink({
  href,
  children,
  variant = "text",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "text" | "solid";
  className?: string;
}) {
  return (
    <a
      className={`cl-action-link cl-action-link--${variant} ${className}`.trim()}
      href={href}
    >
      <span>{children}</span>
      <span className="cl-action-link__arrow" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}
