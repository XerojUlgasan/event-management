import {
  Badge,
  Button,
  NativeDialog,
  useNotifications,
} from "@event-management/ui";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PublicPackage } from "../../lib/data/catalog/packages";
import { PackageCanvas } from "./CatalogContent";
import { BookingRequestDialog } from "../booking-requests/BookingRequestDialog";

export function PackagePreview({
  item,
  loading = false,
  error = "",
  onClose,
  allowBooking = true,
  showBookingAction = true,
  hideServices = false,
  onRetry,
}: {
  item: PublicPackage | null;
  loading?: boolean;
  error?: string;
  allowBooking?: boolean;
  showBookingAction?: boolean;
  hideServices?: boolean;
  onRetry?: () => void;
  onClose: () => void;
}) {
  const { notify } = useNotifications();
  const [booking, setBooking] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);
  useEffect(() => {
    if (!booking && dialogRef.current && !dialogRef.current.open)
      dialogRef.current.showModal();
  }, [booking]);
  const book = () => {
    if (!allowBooking) {
      notify("Customers can book this package from its public page.", "info");
      return;
    }
    dialogRef.current?.close();
    setBooking(true);
  };
  return createPortal(
    <>
      <NativeDialog
        ref={dialogRef}
        className="package-preview"
        aria-label="Package preview"
        onCancel={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <header className="package-preview-bar">
          <Button
            variant="plain"
            className="package-preview-close"
            onClick={onClose}
            aria-label="Close package preview"
          >
            ×
          </Button>
          <span className="package-preview-brand">Styled by AMAC</span>
          <span className="package-preview-divider" />
          <span className="package-preview-label" id={titleId}>
            Package preview
          </span>
          {item?.packageType === "custom" && (
            <Badge tone="cream">Custom package</Badge>
          )}
        </header>
        <div className="package-preview-scroll">
          {loading && <p role="status">Loading package…</p>}
          {error && (
            <div className="package-preview-state" role="alert">
              <p>{error}</p>
              {onRetry && (
                <Button variant="secondary" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          )}
          {item && (
            <PackageCanvas
              item={item}
              hideServices={hideServices}
              bookingAction={
                showBookingAction ? (
                  <Button onClick={book}>Book now</Button>
                ) : undefined
              }
            />
          )}
        </div>
      </NativeDialog>
      {booking && item && (
        <BookingRequestDialog item={item} onClose={() => setBooking(false)} />
      )}
    </>,
    document.body,
  );
}
