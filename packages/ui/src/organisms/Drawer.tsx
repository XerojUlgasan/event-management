import { useId, type ReactNode } from "react";

import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";
import { ModalSurface } from "./ModalSurface";

export function Drawer({
  onClose,
  title,
  status,
  children,
  className = "",
}: {
  onClose: () => void;
  title: ReactNode;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  return (
    <ModalSurface
      className="drawer-backdrop"
      onClose={onClose}
      aria-labelledby={titleId}
    >
      <div className={`detail-drawer${className ? ` ${className}` : ""}`}>
        <Button
          variant="plain"
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <Icon name="close" />
        </Button>
        {status}
        <h2 className="drawer-title" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
    </ModalSurface>
  );
}
