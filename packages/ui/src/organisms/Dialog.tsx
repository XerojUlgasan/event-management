import { useId, type ReactNode, type RefObject } from "react";

import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";
import { ModalSurface } from "./ModalSurface";

export function Dialog({
  onClose,
  initialFocus,
  eyebrow,
  title,
  intro,
  actions,
  children,
  className = "",
  "aria-label": ariaLabel,
}: {
  onClose: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  eyebrow?: ReactNode;
  title?: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const titleId = useId();
  const introId = useId();
  return (
    <ModalSurface className="modal-backdrop" onClose={onClose} initialFocus={initialFocus}
      aria-label={ariaLabel}
      aria-labelledby={title != null ? titleId : undefined}
      aria-describedby={intro != null ? introId : undefined}>
      <div
        className={`modal${className ? ` ${className}` : ""}`}
      >
        <Button
          variant="plain"
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </Button>
        {eyebrow !== undefined && <span className="eyebrow">{eyebrow}</span>}
        {title != null && <h2 id={titleId} className="modal-title">{title}</h2>}
        {intro != null && <p id={introId} className="modal-intro">{intro}</p>}
        {children}
        {actions !== undefined && <div className="form-actions">{actions}</div>}
      </div>
    </ModalSurface>
  );
}
