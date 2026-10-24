import type { ReactNode } from "react";

export function FormField({
  label,
  children,
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className || undefined}>
      <span>{label}</span>
      {children}
    </label>
  );
}
