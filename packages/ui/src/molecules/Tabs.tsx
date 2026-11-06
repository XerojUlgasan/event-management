import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "../atoms/Button";

export type TabItem = {
  value: string;
  label: ReactNode;
  count?: ReactNode;
  disabled?: boolean;
  id?: string;
  panelId?: string;
};

type TabsMode =
  | { role: "tablist"; items: (TabItem & { id: string; panelId: string })[] }
  | { role?: "group"; items: TabItem[] };

export function Tabs({
  items,
  active,
  onChange,
  className = "",
  role = "group",
  variant = "underline",
  onKeyDown,
  ...props
}: {
  active: string;
  onChange?: (value: string) => void;
  variant?: "underline" | "segmented";
} & TabsMode & Omit<ComponentPropsWithoutRef<"div">, "onChange" | "role" | "aria-orientation">) {
  const focusValue = items.find(item => item.value === active && !item.disabled)?.value
    ?? items.find(item => !item.disabled)?.value;
  return (
    <div {...props} role={role} aria-orientation={role === "tablist" ? "horizontal" : undefined} className={`${variant === "segmented" ? "segmented-tabs" : "tab-row"}${className ? ` ${className}` : ""}`} onKeyDown={event => {
      onKeyDown?.(event);
      if (event.defaultPrevented || role !== "tablist" || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="tab"]:not(:disabled)'));
      if (!buttons.length) return;
      event.preventDefault();
      const current = Math.max(0, buttons.findIndex(button => button === event.target));
      const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      const next = buttons[index];
      if (!next) return;
      next.focus();
      const value = next.dataset.tabValue;
      if (value !== undefined) onChange?.(value);
    }}>
      {items.map((item) => (
        <Button
          variant="plain"
          type="button"
          role={role === "tablist" ? "tab" : undefined}
          id={item.id}
          aria-controls={role === "tablist" ? item.panelId : undefined}
          data-tab-value={item.value}
          tabIndex={role === "tablist" ? item.value === focusValue ? 0 : -1 : undefined}
          aria-selected={role === "tablist" ? item.value === active : undefined}
          aria-pressed={role !== "tablist" ? item.value === active : undefined}
          disabled={item.disabled}
          className={item.value === active ? "active" : undefined}
          onClick={onChange ? () => onChange(item.value) : undefined}
          key={item.value}
        >
          {item.label}
          {item.count !== undefined && <span>{item.count}</span>}
        </Button>
      ))}
    </div>
  );
}
