import type { ComponentPropsWithRef } from "react";

export function NativeDialog({ className = "", ...props }: ComponentPropsWithRef<"dialog">) {
  return <dialog {...props} className={["ui-dialog", className].filter(Boolean).join(" ")} />;
}
