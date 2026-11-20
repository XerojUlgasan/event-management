import { useEffect, useRef, useState } from "react";
import { useNotifications } from "@event-management/ui";
import {
  getAdminBookingRequest,
  type BookingStatus,
} from "../../lib/data/booking-requests/requests";

export function useQuotationEligibility({
  admin,
  bookingId,
  quotationId,
  bookingStatus,
  refreshBooking,
  load,
}: {
  admin: boolean;
  bookingId?: string;
  quotationId?: string;
  bookingStatus?: BookingStatus;
  refreshBooking?: () => Promise<void>;
  load: () => Promise<unknown>;
}) {
  const { notifyError } = useNotifications();
  const bookingScope = JSON.stringify([bookingId, admin, quotationId]);
  const bookingScopeRef = useRef({ key: bookingScope, generation: 0 });

  if (bookingScopeRef.current.key !== bookingScope) {
    bookingScopeRef.current = {
      key: bookingScope,
      generation: bookingScopeRef.current.generation + 1,
    };
  }

  const mountedRef = useRef(false);
  const bookingRefreshSequence = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [loadedBooking, setLoadedBooking] = useState<{
    id: string;
    status: BookingStatus;
    generation: number;
  } | null>(null);
  const [bookingError, setBookingError] = useState("");
  const [needsBookingRefresh, setNeedsBookingRefresh] = useState(false);
  const [refreshingBooking, setRefreshingBooking] = useState(false);
  const status =
    bookingStatus ??
    (loadedBooking &&
    loadedBooking.id === bookingId &&
    loadedBooking.generation === bookingScopeRef.current.generation
      ? loadedBooking.status
      : undefined);
  const canWrite =
    admin &&
    !!bookingId &&
    !!status &&
    status !== "declined" &&
    status !== "cancelled" &&
    !needsBookingRefresh &&
    !refreshingBooking;
  const canWriteRef = useRef(canWrite);
  const eligibilityRef = useRef({ allowed: canWrite, generation: 0 });

  if (eligibilityRef.current.allowed !== canWrite) {
    eligibilityRef.current = {
      allowed: canWrite,
      generation: eligibilityRef.current.generation + 1,
    };
  }

  canWriteRef.current = canWrite;

  async function loadBooking() {
    if (!bookingId || !admin) return;

    const requestGeneration = bookingScopeRef.current.generation;
    const sequence = ++bookingRefreshSequence.current;

    const isCurrent = () =>
      mountedRef.current &&
      bookingScopeRef.current.generation === requestGeneration &&
      bookingRefreshSequence.current === sequence;

    canWriteRef.current = false;
    setNeedsBookingRefresh(true);
    setRefreshingBooking(true);
    setBookingError("");

    try {
      if (refreshBooking) await refreshBooking();
      else {
        const result = await getAdminBookingRequest(bookingId);

        if (!isCurrent()) return;

        setLoadedBooking({
          id: bookingId,
          status: result.bookingRequest.status,
          generation: requestGeneration,
        });
      }

      if (!isCurrent()) return;

      if ((await load()) && isCurrent()) setNeedsBookingRefresh(false);
    } catch (cause) {
      if (!isCurrent()) return;

      setBookingError(notifyError(cause, "Unable to refresh the booking."));
      setNeedsBookingRefresh(true);
    } finally {
      if (isCurrent()) setRefreshingBooking(false);
    }
  }

  useEffect(() => {
    setNeedsBookingRefresh(false);
    setRefreshingBooking(false);
    setBookingError("");
  }, [bookingScope]);

  useEffect(() => {
    if (!admin || bookingStatus !== undefined || !bookingId) return;

    let active = true;
    const requestGeneration = bookingScopeRef.current.generation;

    setLoadedBooking(null);
    setBookingError("");
    void getAdminBookingRequest(bookingId)
      .then((result) => {
        if (active)
          setLoadedBooking({
            id: bookingId,
            status: result.bookingRequest.status,
            generation: requestGeneration,
          });
      })
      .catch((cause) => {
        if (active)
          setBookingError(notifyError(cause, "Unable to load the booking."));
      });

    return () => {
      active = false;
    };
  }, [admin, bookingId, bookingStatus, bookingScope]);

  return {
    status,
    canWrite,
    canWriteRef,
    eligibilityRef,
    mountedRef,
    bookingScopeRef,
    bookingError,
    needsBookingRefresh,
    setNeedsBookingRefresh,
    refreshingBooking,
    loadBooking,
  };
}
