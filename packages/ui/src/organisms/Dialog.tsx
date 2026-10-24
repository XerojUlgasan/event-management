import type { ReactNode } from "react";

import { Icon } from "../atoms/Icon";

export function Dialog({
  onClose,
  eyebrow,
  title,
  intro,
  actions,
  children,
  className = "",
}: {
  onClose: () => void;
  eyebrow?: ReactNode;
  title?: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal${className ? ` ${className}` : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
        {eyebrow !== undefined && <span className="eyebrow">{eyebrow}</span>}
        {title !== undefined && <div className="modal-title">{title}</div>}
        {intro !== undefined && <p className="modal-intro">{intro}</p>}
        {children}
        {actions !== undefined && <div className="form-actions">{actions}</div>}
      </div>
    </div>
  );
}
