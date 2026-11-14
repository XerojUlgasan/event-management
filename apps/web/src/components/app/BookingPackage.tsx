import "../../styles/booking-request.css";
import { useEffect, useRef, useState } from "react";
import { Button, Pagination, useNotifications } from "@event-management/ui";
import {
  getBookingPackage,
  getBookingPackageHistory,
  saveBookingPackage,
  type BookingPackageResult,
  type PackageHistoryEntry,
} from "../../lib/data/booking-packages";
import { usePagination } from "../../lib/use-pagination";
import { PackageCanvas } from "../catalog/CatalogContent";
import { PackageEditor } from "./pages/PackageEditor";

export function BookingPackage({
  id,
  admin,
  onChanged,
  editable = true,
}: {
  id: string;
  admin: boolean;
  editable?: boolean;
  onChanged?: () => void;
}) {
  const { notifyError } = useNotifications();
  const generation = useRef(0);
  const [loaded, setLoaded] = useState<BookingPackageResult | null>(null);
  const [history, setHistory] = useState<PackageHistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loadedIdentity, setLoadedIdentity] = useState("");
  const identity = JSON.stringify([id, admin]);
  const pagination = usePagination(identity);
  const key = JSON.stringify([id, admin, pagination.cursor ?? null]);
  const keyRef = useRef(key);
  keyRef.current = key;
  const request = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const current = generation.current;
    const sequence = ++request.current;
    const requestKey = key;
    setBusy(true);
    setError("");
    try {
      const [result, audit] = await Promise.all([
        getBookingPackage(id, admin),
        admin ? getBookingPackageHistory(id, pagination.cursor) : Promise.resolve(null),
      ]);
      if (current !== generation.current || sequence !== request.current || keyRef.current !== requestKey) return;
      setLoaded(result);
      setHistory(audit?.history ?? []);
      setNextCursor(audit?.nextCursor ?? null);
      setLoadedKey(requestKey);
      setLoadedIdentity(identity);
    } catch (cause) {
      if (current !== generation.current || sequence !== request.current || keyRef.current !== requestKey) return;
      setError(notifyError(cause, "Unable to load the proposed package."));
    } finally {
      if (current === generation.current && sequence === request.current && keyRef.current === requestKey) setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    return () => { generation.current++; };
  }, [id, admin, pagination.cursor]);

  return (
    <section aria-label="Package" className="booking-current-package">
      {busy && <p role="status">Loading package…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </p>
      )}
      {loadedIdentity === identity && loaded && !editing && (
        <>
          {admin && editable && (
            <div className="booking-actions">
              <Button disabled={busy} onClick={() => setEditing(true)}>
                Edit package
              </Button>
            </div>
          )}
          <PackageCanvas item={loaded.package} hideServices />
        </>
      )}
      {admin && loadedKey === key && (history.length > 0 || pagination.page > 1 || !!nextCursor) && !editing && (
        <details>
          <summary>Private package edit history</summary>
          {history.map((entry) => (
            <details key={entry.id}>
              <summary>
                {new Date(entry.createdAt).toLocaleString()} ·{" "}
                {entry.action === "booking.custom_package_created"
                  ? "Created"
                  : "Updated"}{" "}
                · {entry.actorId ?? "Unknown administrator"}
              </summary>
              <p>
                Previous: {entry.before.name} · {entry.before.maxGuests} guests
                · {entry.before.price.amountMinor / 100} PHP
              </p>
              <p>
                Saved: {entry.after.name} · {entry.after.maxGuests} guests ·{" "}
                {entry.after.price.amountMinor / 100} PHP
              </p>
              <p>
                Historical media may no longer be available unless retained in a
                quotation.
              </p>
              <details>
                <summary>Previous content</summary>
                <p>{entry.before.description}</p>
                <PackageCanvas item={entry.before} hideServices />
              </details>
              <details>
                <summary>Saved content</summary>
                <p>{entry.after.description}</p>
                <PackageCanvas item={entry.after} hideServices />
              </details>
            </details>
          ))}
          <Pagination page={pagination.page} hasNextPage={!!nextCursor} onPrevious={pagination.previous} onNext={() => pagination.next(nextCursor)} pending={busy} label="Package history" />
        </details>
      )}
      {loadedIdentity === identity && editing && loaded && (
        <PackageEditor
          initial={loaded.package}
          onClose={() => {
            setEditing(false);
            void load();
          }}
          onSaved={() => {
            setEditing(false);
            if (pagination.page === 1) void load();
            else pagination.reset();
            onChanged?.();
          }}
          saveCustom={async (content) => {
            await saveBookingPackage(
              id,
              content,
              {
                expectedBookingUpdatedAt: loaded.bookingUpdatedAt,
                expectedUpdatedAt: loaded.package.updatedAt,
                ...(loaded.package.packageType === "catalog"
                  ? { sourcePackageId: loaded.package.id }
                  : {}),
              },
              loaded.package.packageType === "custom",
            );
          }}
        />
      )}
    </section>
  );
}
