import type { ComponentPropsWithRef } from "react";

export function Textarea({ variant = "default", className = "", ...props }: {
  variant?: "default" | "plain";
} & ComponentPropsWithRef<"textarea">) {
  return <textarea {...props} className={[variant === "default" ? "ui-control" : "ui-control-plain", className].filter(Boolean).join(" ") || undefined} />;
}
