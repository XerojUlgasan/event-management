import { NotificationProvider } from "@event-management/ui";
import { useState } from "react";
import { BookingRequestDialog } from "../../booking-requests/BookingRequestDialog";
import type { PublicPackage } from "../../../lib/data/catalog/packages";

export function PublicPackageBooking({ item }: { item: PublicPackage }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <a
        className="button button-primary"
        href={`/login?book=${encodeURIComponent(item.slug)}`}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;

          event.preventDefault();
          setOpen(true);
        }}
      >
        Book now
      </a>
      {open && (
        <NotificationProvider>
          <BookingRequestDialog item={item} onClose={() => setOpen(false)} />
        </NotificationProvider>
      )}
    </>
  );
}
