import { Button, useNotifications } from "@event-management/ui";
import { useEffect, useRef, useState } from "react";
import {
  getAdminBookingStatusHistory,
  type BookingStatusHistoryEntry,
} from "../../../../lib/data/booking-requests/requests";
import { useRequestGeneration } from "../../../../lib/pagination/use-request-generation";
import {
  bookingDateTime,
  bookingStatusLabels,
} from "../../../booking-requests/BookingRequestDisplay";

type HistoryRequest = { cursor?: string; firstOlderIndex?: number };

type HistoryResult = {
  request: HistoryRequest;
  entries: BookingStatusHistoryEntry[];
  nextCursor: string | null;
  error: string;
};

export function AdminBookingStatusHistory({
  id,
  revision,
  timeZone,
}: {
  id: string;
  revision: string;
  timeZone: string;
}) {
  return (
    <StatusHistory
      key={JSON.stringify([id, revision])}
      id={id}
      timeZone={timeZone}
    />
  );
}

function StatusHistory({ id, timeZone }: { id: string; timeZone: string }) {
  const { notifyError } = useNotifications();
  const generation = useRequestGeneration();
  const olderButton = useRef<HTMLButtonElement>(null);
  const firstOlderEntry = useRef<HTMLLIElement>(null);
  const [request, setRequest] = useState<HistoryRequest>({});
  const [result, setResult] = useState<HistoryResult | null>(null);
  const loading = result?.request !== request;
  const error = loading ? "" : result.error;
  const entries = result?.entries ?? [];
  const cursor = result?.nextCursor ?? undefined;

  useEffect(() => {
    const current = generation.bump();

    getAdminBookingStatusHistory(id, request.cursor)
      .then(({ history, nextCursor }) => {
        if (!generation.isCurrent(current)) return;

        setResult((previous) => ({
          request,
          entries: [...(previous?.entries ?? []), ...history],
          nextCursor,
          error: "",
        }));
      })
      .catch((cause) => {
        if (!generation.isCurrent(current)) return;

        const message = request.cursor
          ? "Unable to load older status changes."
          : "Unable to load status history.";

        notifyError(cause, message);
        setResult((previous) => ({
          request,
          entries: previous?.entries ?? [],
          nextCursor: previous?.nextCursor ?? null,
          error: message,
        }));
      });

    return () => {
      generation.bump();
    };
  }, [generation, id, notifyError, request]);

  useEffect(() => {
    if (loading || error || !request.cursor) return;

    // Keep the reading position when the last page removes the focused button.
    if (
      document.activeElement === document.body ||
      document.activeElement === olderButton.current
    )
      firstOlderEntry.current?.focus();
  }, [loading, error, request]);

  return (
    <>
      {loading && !request.cursor && (
        <p role="status">Loading status history…</p>
      )}
      {!loading && !error && !entries.length && (
        <p>No status history available.</p>
      )}
      {entries.length > 0 && (
        <ol className="booking-status-timeline">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              ref={
                index === request.firstOlderIndex ? firstOlderEntry : undefined
              }
              tabIndex={-1}
            >
              <strong>{bookingStatusLabels[entry.status]}</strong>
              <time dateTime={entry.createdAt}>
                {bookingDateTime(entry.createdAt, timeZone)}
              </time>
              {entry.reason && <p>{entry.reason}</p>}
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert">{error}</p>}
      {(cursor || result?.error) && (
        <Button
          ref={olderButton}
          variant="secondary"
          size="small"
          pending={loading}
          onClick={() =>
            setRequest({ cursor, firstOlderIndex: entries.length })
          }
        >
          {loading ? "Loading…" : error ? "Try again" : "Load older changes"}
        </Button>
      )}
    </>
  );
}
