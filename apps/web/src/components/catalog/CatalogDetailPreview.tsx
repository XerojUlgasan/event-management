import { Button, NativeDialog } from "@event-management/ui";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
export function CatalogDetailPreview({
  entity,
  children,
  onClose,
}: {
  entity: "service" | "venue";
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const title = `${entity[0].toUpperCase()}${entity.slice(1)} preview`;
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);
  return createPortal(
    <NativeDialog
      ref={dialogRef}
      className="package-preview"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="package-preview-bar">
        <Button
          variant="plain"
          type="button"
          className="package-preview-close"
          aria-label={`Close ${entity} preview`}
          onClick={onClose}
        >
          ×
        </Button>
        <span className="package-preview-brand">Clemora</span>
        <span className="package-preview-divider" />
        <span className="package-preview-label">{title}</span>
      </header>
      <div className="package-preview-scroll">{children}</div>
    </NativeDialog>,
    document.body,
  );
}
