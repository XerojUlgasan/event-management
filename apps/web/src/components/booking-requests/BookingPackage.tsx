import "../../styles/booking-requests/booking-request.css";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Pagination,
  Select,
  useNotifications,
} from "@event-management/ui";
import {
  assignBookingPackage,
  getBookingPackage,
  getBookingPackageHistory,
  saveBookingPackage,
  type BookingPackageResult,
  type PackageHistoryEntry,
} from "../../lib/data/booking-requests/packages";
import { usePagination } from "../../lib/pagination/use-pagination";
import { useRequestGeneration } from "../../lib/pagination/use-request-generation";
import { centavosToPesos } from "../../lib/utils/formatting/money";
import {
  getPackages,
  type PublicPackage,
} from "../../lib/data/catalog/packages";
import { PackageCanvas } from "../catalog/CatalogContent";
import { PackageEditor } from "../catalog/PackageEditor";

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
  const generation = useRequestGeneration();
  const [loaded, setLoaded] = useState<BookingPackageResult | null>(null);
  const [history, setHistory] = useState<PackageHistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [options, setOptions] = useState<PublicPackage[]>([]);
  const [optionCursor, setOptionCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [selecting, setSelecting] = useState(false);
  async function loadOptions(cursor?: string) {
    try {
      const result = await getPackages(cursor ? { cursor } : undefined);
      setOptions((old) =>
        cursor ? [...old, ...result.packages] : result.packages,
      );
      setOptionCursor(result.nextCursor);
    } catch (cause) {
      notifyError(cause, "Unable to load packages.");
    }
  }
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
    const current = generation.current();
    const sequence = ++request.current;
    const requestKey = key;
    setBusy(true);
    setError("");

    try {
      const [result, audit] = await Promise.all([
        getBookingPackage(id, admin),
        admin
          ? getBookingPackageHistory(id, pagination.cursor)
          : Promise.resolve(null),
      ]);

      if (
        !generation.isCurrent(current) ||
        sequence !== request.current ||
        keyRef.current !== requestKey
      )
        return;

      setLoaded(result);
      setHistory(audit?.history ?? []);
      setNextCursor(audit?.nextCursor ?? null);
      setLoadedKey(requestKey);
      setLoadedIdentity(identity);
    } catch (cause) {
      if (
        !generation.isCurrent(current) ||
        sequence !== request.current ||
        keyRef.current !== requestKey
      )
        return;

      setError(notifyError(cause, "Unable to load the proposed package."));
    } finally {
      if (
        generation.isCurrent(current) &&
        sequence === request.current &&
        keyRef.current === requestKey
      )
        setBusy(false);
    }
  }

  useEffect(() => {
    void load();

    return () => {
      generation.bump();
    };
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
          {!loaded.package && (
            <p>Package to be prepared. Amount to be discussed.</p>
          )}
          {admin && editable && (
            <div className="booking-actions">
              <Button disabled={busy} onClick={() => setEditing(true)}>
                {loaded.package ? "Edit package" : "Create custom package"}
              </Button>
              {!loaded.package && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelecting(true);
                    void loadOptions();
                  }}
                >
                  Choose catalog package
                </Button>
              )}
            </div>
          )}
          {selecting && !loaded.package && (
            <div>
              <label>
                Catalog package{" "}
                <Select
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="">Choose a package</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </label>
              {optionCursor && (
                <Button
                  variant="secondary"
                  onClick={() => void loadOptions(optionCursor)}
                >
                  Load more packages
                </Button>
              )}
              <Button
                disabled={!selected || busy}
                onClick={async () => {
                  const option = options.find((item) => item.id === selected);

                  if (!option) return;

                  setBusy(true);

                  try {
                    await assignBookingPackage(id, {
                      packageId: option.id,
                      expectedBookingUpdatedAt: loaded.bookingUpdatedAt,
                      packageUpdatedAt: option.updatedAt,
                    });
                    setSelecting(false);
                    await load();
                    onChanged?.();
                  } catch (cause) {
                    setError(notifyError(cause, "Unable to assign package."));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Assign package
              </Button>
              <Button variant="secondary" onClick={() => setSelecting(false)}>
                Cancel
              </Button>
            </div>
          )}
          {loaded.package && (
            <PackageCanvas item={loaded.package} />
          )}
        </>
      )}
      {admin &&
        loadedKey === key &&
        (history.length > 0 || pagination.page > 1 || !!nextCursor) &&
        !editing && (
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
                  Previous:{" "}
                  {entry.before
                    ? `${entry.before.name} · ${entry.before.maxGuests} guests · ${centavosToPesos(entry.before.price.amountMinor)} PHP`
                    : "No package"}
                </p>
                <p>
                  Saved: {entry.after.name} · {entry.after.maxGuests} guests ·{" "}
                  {centavosToPesos(entry.after.price.amountMinor)} PHP
                </p>
                <p>
                  Historical media may no longer be available unless retained in
                  a quotation.
                </p>
                {entry.before && (
                  <details>
                    <summary>Previous content</summary>
                    <p>{entry.before.description}</p>
                    <PackageCanvas item={entry.before} />
                  </details>
                )}
                <details>
                  <summary>Saved content</summary>
                  <p>{entry.after.description}</p>
                  <PackageCanvas item={entry.after} />
                </details>
              </details>
            ))}
            <Pagination
              page={pagination.page}
              hasNextPage={!!nextCursor}
              onPrevious={pagination.previous}
              onNext={() => pagination.next(nextCursor)}
              pending={busy}
              label="Package history"
            />
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
                ...(loaded.package
                  ? { expectedUpdatedAt: loaded.package.updatedAt }
                  : {}),
                ...(loaded.package?.packageType === "catalog"
                  ? { sourcePackageId: loaded.package.id }
                  : {}),
              },
              loaded.package?.packageType === "custom",
            );
          }}
        />
      )}
    </section>
  );
}
