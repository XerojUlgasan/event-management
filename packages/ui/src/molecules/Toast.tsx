import type { ReactNode } from "react";

import { Icon } from "../atoms/Icon";

export function Toast({
  children,
  icon = "check",
  className = "",
}: {
  children: ReactNode;
  icon?: string;
  className?: string;
}) {
  return (
    <div
      className={`toast-message${className ? ` ${className}` : ""}`}
      role="status"
    >
      <Icon name={icon} />
      {children}
    </div>
  );
}
