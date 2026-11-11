import "../../styles/booking-request.css";
import { useEffect, useState } from "react";
import { Button, Select } from "@event-management/ui";
import {
  getBookingPackage,
  getBookingPackageHistory,
  saveBookingPackage,
  type BookingPackageResult,
  type PackageHistoryEntry,
} from "../../lib/data/booking-packages";
import {
  getAdminPackage,
  getAdminPackages,
  type AdminPackage,
} from "../../lib/data/packages";
import { getAdminServices, type AdminService } from "../../lib/data/services";
import { PackageCanvas, PackagePreview } from "./PackagePreview";
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
  const [loaded, setLoaded] = useState<BookingPackageResult | null>(null);
  const [history, setHistory] = useState<PackageHistoryEntry[]>([]);
  const [catalog, setCatalog] = useState<AdminPackage[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [base, setBase] = useState<AdminPackage | null>(null);
  const [view, setView] = useState<"preview" | "edit" | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const [result, packages, options, audit] = await Promise.all([
        getBookingPackage(id, admin),
        admin ? getAdminPackages() : Promise.resolve(null),
        admin ? getAdminServices() : Promise.resolve(null),
        admin ? getBookingPackageHistory(id) : Promise.resolve(null),
      ]);
      setLoaded(result);
      setHistory(audit?.history ?? []);
      setBase(result.package);
      setCatalog(packages?.packages.filter((p) => !p.archivedAt) ?? []);
      setServices(options?.services ?? []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load the proposed package.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [id, admin]);
  async function chooseBase(value: string) {
    setBusy(true);
    setError("");
    try {
      setBase(await getAdminPackage(value));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load package.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Current proposal" className="booking-current-package">
      <h3>Current proposal</h3>
      {busy && <p role="status">Loading package…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </p>
      )}
      {loaded && (
        <>
          <p>
            <strong>{loaded.package.name}</strong> ·{" "}
            {loaded.package.packageType === "custom"
              ? "Private custom package"
              : "Catalog package"}
          </p>
          <div className="booking-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setView("preview")}
            >
              View proposal
            </Button>
            {admin && editable && loaded.package.packageType !== "custom" && (
              <label>
                Starting package{" "}
                <Select
                  value={base?.id ?? ""}
                  disabled={busy}
                  onChange={(e) => void chooseBase(e.target.value)}
                >
                  {catalog.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {admin && editable && (
              <Button disabled={busy || !base} onClick={() => setView("edit")}>
                {loaded.package.packageType === "custom"
                  ? "Edit custom package"
                  : "Customize package"}
              </Button>
            )}
          </div>
        </>
      )}
      {admin && history.length > 0 && (
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
                <PackageCanvas item={entry.before} />
              </details>
              <details>
                <summary>Saved content</summary>
                <p>{entry.after.description}</p>
                <PackageCanvas item={entry.after} />
              </details>
            </details>
          ))}
        </details>
      )}
      {view === "preview" && loaded && (
        <PackagePreview
          item={loaded.package}
          allowBooking={false}
          onClose={() => setView(null)}
        />
      )}
      {view === "edit" && loaded && base && (
        <PackageEditor
          initial={base}
          serviceOptions={services}
          onClose={() => {
            setView(null);
            void load();
          }}
          onSaved={() => {
            setView(null);
            void load();
            onChanged?.();
          }}
          saveCustom={async (content) => {
            await saveBookingPackage(
              id,
              content,
              {
                expectedBookingUpdatedAt: loaded.bookingUpdatedAt,
                expectedUpdatedAt: base.updatedAt,
                ...(loaded.package.packageType === "catalog"
                  ? { sourcePackageId: base.id }
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
