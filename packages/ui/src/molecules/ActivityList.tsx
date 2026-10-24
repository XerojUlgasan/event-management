import type { ReactNode } from "react";

export type ActivityItem = {
  title: ReactNode;
  detail: ReactNode;
};

export function ActivityList({
  items,
  className = "",
}: {
  items: ActivityItem[];
  className?: string;
}) {
  return (
    <div className={`quote-history${className ? ` ${className}` : ""}`}>
      {items.map((item, index) => (
        <span key={index}>
          <i></i>
          <span>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </span>
        </span>
      ))}
    </div>
  );
}
