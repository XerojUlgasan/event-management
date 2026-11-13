import type { ReactNode } from "react";

import { Icon, type IconName } from "../atoms/Icon";

export type ToastTone = "success" | "danger" | "info";

export function Toast({
  children,
  icon,
  tone = "success",
  placement = "floating",
  className = "",
}: {
  children: ReactNode;
  icon?: IconName;
  tone?: ToastTone;
  placement?: "floating" | "inline";
  className?: string;
}) {
  return (
    <div
      className={`toast-message toast-${tone}${placement === "inline" ? " toast-inline" : ""}${className ? ` ${className}` : ""}`}
      role={tone === "danger" ? "alert" : "status"}
      aria-atomic="true"
    >
      <Icon name={icon ?? (tone === "danger" ? "alert" : tone === "info" ? "info" : "check")} />
      {children}
    </div>
  );
}
