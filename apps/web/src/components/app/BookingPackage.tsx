import { useRef, useState } from "react";
import { Badge, Button } from "@event-management/ui";
import { getAdminBookingRequest, getBookingPackage, saveBookingCustomPackage, type AdminPackage, type BookingRequest, type PackageContent } from "../../lib/api";
import { PackagePreview } from "./PackagePreview";
import { PackageEditor } from "./pages/PackagesPage";

type Loaded = { package: AdminPackage; bookingUpdatedAt: string };

export function BookingPackage({ item, admin, restricted = false, onSaved, onMessage }: { item: BookingRequest; admin: boolean; restricted?: boolean; onSaved?: (item: BookingRequest) => void; onMessage?: () => void }) {
  const openTrigger = useRef<HTMLElement | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [view, setView] = useState<"preview" | "edit" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = async (next: "preview" | "edit") => {
    setBusy(true); setError("");
    try { setLoaded(await getBookingPackage(item.id, admin)); setView(next); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load the package."); }
    finally { setBusy(false); }
  };
  const refresh = async () => {
    setView(null); setLoaded(null); setBusy(true); setError("");
    try {
      const result = await getAdminBookingRequest(item.id);
      onSaved?.(result.bookingRequest);
      setError("Booking refreshed. Open the package editor to start again.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to refresh the booking."); }
    finally { setBusy(false); }
  };
  const save = async (content: PackageContent) => {
    if (!loaded) return;
    const result = await saveBookingCustomPackage(item.id, content, { expectedBookingUpdatedAt: loaded.bookingUpdatedAt, expectedUpdatedAt: loaded.package.updatedAt }, loaded.package.packageType === "custom");
    onSaved?.(result.bookingRequest);
  };
  const price = item.packagePrice
    ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(item.packagePrice.amountMinor / 100)
    : "Private package";
  return <section className="booking-current-package" aria-label="Current package">
    <div className="booking-current-package-head">
      <h3>Current package</h3>
      <Badge tone="neutral">{item.packageType === "custom" ? "Custom · Private" : "Catalog"}</Badge>
    </div>
    {!restricted ? (
      <div className="booking-current-package-details">
        <div>
          <span>Package price</span>
          <strong>{price}</strong>
        </div>
        {item.packageInclusions.length > 0 && (
          <div className="booking-current-package-services">
            <span>Included services</span>
            <ul>
              {item.packageInclusions.map((service) => (
                <li key={service.serviceId}>
                  {service.name}
                  <small>{service.role}</small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    ) : (
      <p className="booking-current-package-restricted">
        Private package details are available to the customer and System Administrator.
      </p>
    )}
    <div className="booking-actions" onClickCapture={event => { if (event.target instanceof Element) openTrigger.current = event.target.closest("button"); }}>
      <Button variant="secondary" disabled={busy} onClick={() => void open("preview")}>{busy ? "Loading…" : "View package"}</Button>
      {admin && !["declined", "cancelled"].includes(item.status) && <Button disabled={busy} onClick={() => void open("edit")}>{item.packageType === "custom" ? "Edit custom package" : "Customize package"}</Button>}
      {onMessage && <Button variant="secondary" onClick={onMessage}>Message the team</Button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {view === "preview" && loaded && <PackagePreview item={loaded.package} allowBooking={false} returnFocus={openTrigger.current} onClose={() => setView(null)} />}
    {view === "edit" && loaded && <PackageEditor initial={loaded.package} returnFocus={openTrigger.current} saveCustom={save} onClose={() => setView(null)} onSaved={() => { setView(null); setLoaded(null); }} onRefresh={() => void refresh()} />}
  </section>;
}
