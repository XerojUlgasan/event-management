import type { ReactNode } from "react";

export type TabItem = {
  value: string;
  label: ReactNode;
  count?: ReactNode;
};

export function Tabs({
  items,
  active,
  onChange,
  className = "",
}: {
  items: TabItem[];
  active: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`tab-row${className ? ` ${className}` : ""}`}>
      {items.map((item) => (
        <button
          type="button"
          className={item.value === active ? "active" : undefined}
          onClick={onChange ? () => onChange(item.value) : undefined}
          key={item.value}
        >
          {item.label}
          {item.count !== undefined && <span>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
