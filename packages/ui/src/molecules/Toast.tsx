import type { ReactNode } from "react";

import { Icon, type IconName } from "../atoms/Icon";

export type ToastTone = "success" | "danger";

export function Toast({
  children,
  icon,
  tone = "success",
  className = "",
}: {
  children: ReactNode;
  icon?: IconName;
  tone?: ToastTone;
  className?: string;
}) {
  return (
    <div
      className={`toast-message toast-${tone}${className ? ` ${className}` : ""}`}
      role={tone === "danger" ? "alert" : "status"}
      aria-atomic="true"
    >
      <Icon name={icon ?? (tone === "danger" ? "alert" : "check")} />
      {children}
    </div>
  );
}
