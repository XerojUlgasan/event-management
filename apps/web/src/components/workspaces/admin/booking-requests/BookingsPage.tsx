import { BookingList } from "../../../booking-requests/BookingList";
import { BookingRequestPage } from "./BookingRequestPage";

export function BookingsPage({
  bookingRequestId,
}: {
  bookingRequestId?: string;
}) {
  return bookingRequestId ? (
    <BookingRequestPage
      key={bookingRequestId}
      bookingRequestId={bookingRequestId}
    />
  ) : (
    <div className="content-stack">
      <BookingList admin />
    </div>
  );
}
