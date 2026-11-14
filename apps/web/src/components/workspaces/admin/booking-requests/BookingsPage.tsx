import { BookingList } from "../../../booking-requests/BookingList";
import { BookingRequestPage } from "./BookingRequestPage";
export function BookingsPage({
  bookingRequestId,
}: {
  bookingRequestId?: string;
}) {
  return bookingRequestId ? (
    <BookingRequestPage bookingRequestId={bookingRequestId} />
  ) : (
    <div className="content-stack">
      <BookingList admin />
    </div>
  );
}
