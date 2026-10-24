import type { ReactNode } from "react";

import { Icon } from "../atoms/Icon";

export function Drawer({
  onClose,
  children,
  className = "",
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        className={`detail-drawer${className ? ` ${className}` : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <Icon name="close" />
        </button>
        {children}
      </aside>
    </div>
  );
}
