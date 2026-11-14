import type { ComponentPropsWithRef } from "react";

export function Select({
  variant = "default",
  className = "",
  ...props
}: {
  variant?: "default" | "plain";
} & ComponentPropsWithRef<"select">) {
  return (
    <select
      {...props}
      className={
        [variant === "default" ? "ui-control" : "ui-control-plain", className]
          .filter(Boolean)
          .join(" ") || undefined
      }
    />
  );
}
