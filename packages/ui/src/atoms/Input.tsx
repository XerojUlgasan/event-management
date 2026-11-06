import type { ComponentPropsWithRef } from "react";

export function Input({ variant = "default", className = "", ...props }: {
  variant?: "default" | "plain";
} & ComponentPropsWithRef<"input">) {
  return <input {...props} className={[variant === "default" ? "ui-control" : "ui-control-plain", className].filter(Boolean).join(" ") || undefined} />;
}
