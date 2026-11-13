import { Button, Pagination } from "@event-management/ui";
import { useEffect, useRef, useState } from "react";
import { getBookingStatusHistory, type BookingStatusHistoryEntry } from "../../lib/data/booking-requests";
import { usePagination } from "../../lib/use-pagination";
import { bookingDateTime, bookingStatusLabels } from "./booking-request-display";

export function BookingStatusHistory({ id, admin, revision, timeZone, className = "booking-history", summary = "Status history" }: { id: string; admin: boolean; revision: string; timeZone: string; className?: string; summary?: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<BookingStatusHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const pagination = usePagination(JSON.stringify([id, admin, revision]));
  useEffect(() => {
    if (!open) return;
    const current = ++generation.current;
    setLoading(true); setError("");
    getBookingStatusHistory(id, admin, pagination.cursor).then(result => {
      if (generation.current !== current) return;
      setEntries(result.history); setNextCursor(result.nextCursor);
    }).catch(() => {
      if (generation.current === current) setError("Unable to load status history.");
    }).finally(() => { if (generation.current === current) setLoading(false); });
    return () => { generation.current++; };
  }, [open, id, admin, revision, pagination.cursor, retry]);
  return <details className={className} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{summary}</summary>
    {open && <>
      {loading && <p role="status">Loading status history…</p>}
      {error && <p role="alert">{error} <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>Try again</Button></p>}
      {!loading && !error && entries.length === 0 && <p>No status history available.</p>}
      {!loading && !error && <ul>{entries.map(entry => <li key={entry.id}><strong>{bookingStatusLabels[entry.status]}</strong><span>{bookingDateTime(entry.createdAt, timeZone)}{entry.reason ? ` · ${entry.reason}` : ""}</span></li>)}</ul>}
      {!error && <Pagination page={pagination.page} hasNextPage={nextCursor !== null} pending={loading} onPrevious={pagination.previous} onNext={() => pagination.next(nextCursor)} label="Status history pages" />}
    </>}
  </details>;
}
