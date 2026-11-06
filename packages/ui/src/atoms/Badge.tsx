import type { ComponentPropsWithoutRef } from "react";

export type BadgeTone = "neutral" | "cream" | "light" | "gold" | "success" | "warning" | "danger" | "info" | "accent";

export function Badge({
  children,
  tone = "neutral",
  className = "",
  variant = "pill",
  ...props
}: {
  tone?: BadgeTone
  variant?: "pill" | "counter"
} & ComponentPropsWithoutRef<"span">) {
  return <span {...props} className={`badge badge-${tone}${variant === "counter" ? " badge-counter" : ""}${className ? ` ${className}` : ""}`}>{children}</span>
}

