import { Button } from "@event-management/ui";
import type { BookingStatus } from "../../lib/data/booking-requests/requests";

export function QuotationNotices({
  admin,
  status,
  bookingError,
  needsBookingRefresh,
  refreshingBooking,
  onRefreshBooking,
  bookingId,
  quotationId,
  loading,
  error,
  busy,
  onReload,
}: {
  admin: boolean;
  status?: BookingStatus;
  bookingError: string;
  needsBookingRefresh: boolean;
  refreshingBooking: boolean;
  onRefreshBooking: () => void;
  bookingId?: string;
  quotationId?: string;
  loading: boolean;
  error: string;
  busy: boolean;
  onReload: () => void;
}) {
  return (
    <>
      {admin && (status === "declined" || status === "cancelled") && (
        <p>This request is {status}. Packages and quotations are read-only.</p>
      )}
      {admin && (bookingError || needsBookingRefresh) && (
        <p role="alert">
          {bookingError || "Refresh the booking before retrying."}{" "}
          <Button
            variant="secondary"
            disabled={refreshingBooking}
            onClick={onRefreshBooking}
          >
            Refresh booking
          </Button>
        </p>
      )}
      {admin && quotationId && bookingId && (
        <p className="quotation-meta">
          <a href={`/app/bookings/${encodeURIComponent(bookingId)}`}>
            Open booking quotations to continue editing revisions
          </a>
        </p>
      )}
      {loading && <p role="status">Loading quotations…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="secondary" disabled={busy} onClick={onReload}>
            Refresh quotations
          </Button>
        </p>
      )}
    </>
  );
}
