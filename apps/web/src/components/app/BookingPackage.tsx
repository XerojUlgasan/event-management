import "../../styles/booking-request.css";
import { useEffect, useRef, useState } from "react";
import { Button, useNotifications } from "@event-management/ui";
import {
  getBookingPackage,
  getBookingPackageHistory,
  saveBookingPackage,
  type BookingPackageResult,
  type PackageHistoryEntry,
} from "../../lib/data/booking-packages";
import { getAdminServices, type AdminService } from "../../lib/data/services";
import { PackageCanvas } from "./PackagePreview";
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
  const [services, setServices] = useState<AdminService[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const current = generation.current;
    setBusy(true);
    setError("");
    try {
      const [result, options, audit] = await Promise.all([
        getBookingPackage(id, admin),
        admin ? getAdminServices() : Promise.resolve(null),
        admin ? getBookingPackageHistory(id) : Promise.resolve(null),
      ]);
      if (current !== generation.current) return;
      setLoaded(result);
      setHistory(audit?.history ?? []);
      setServices(options?.services ?? []);
    } catch (cause) {
      if (current !== generation.current) return;
      setError(notifyError(cause, "Unable to load the proposed package."));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    return () => { generation.current++; };
  }, [id, admin]);

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
      {loaded && !editing && (
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
      {admin && history.length > 0 && !editing && (
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
        </details>
      )}
      {editing && loaded && (
        <PackageEditor
          initial={loaded.package}
          serviceOptions={services}
          onClose={() => {
            setEditing(false);
            void load();
          }}
          onSaved={() => {
            setEditing(false);
            void load();
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
