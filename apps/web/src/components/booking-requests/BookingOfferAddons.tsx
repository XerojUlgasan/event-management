import { useState } from "react";
import {
  Button,
  Dialog,
  FormField,
  Input,
  useNotifications,
} from "@event-management/ui";
import type { ServicePricing } from "@event-management/contracts/catalog";
import { servicePricingSchema } from "@event-management/contracts/catalog-service-terms";
import { MAX_BOOKING_ADDON_HOURS } from "@event-management/contracts/limits/booking-requests";
import { CatalogReferencePickerDialog } from "../catalog/CatalogReferencePickerDialog";
import { getAdminService } from "../../lib/data/catalog/services";
import { ServicePricingFields } from "../catalog/ServiceDetailsFields";
import {
  addBookingAddon,
  updateBookingAddon,
  removeBookingAddon,
  type BookingRequest,
  type BookingService,
} from "../../lib/data/booking-requests/requests";
import "../../styles/booking-requests/booking-intake.css";
import {
  bookingHoursLabel,
  bookingOfferAmountLabel,
} from "../../lib/utils/formatting/money";

type Editor = {
  serviceId: string;
  addonId?: string;
  name: string;
  pricing: ServicePricing;
  totalHours: number | null;
  expectedBookingUpdatedAt: string;
};

export function BookingOfferAddons({
  booking,
  onChanged,
  disabled = false,
  onBusyChange,
}: {
  booking: BookingRequest;
  onChanged: (booking: BookingRequest) => void | Promise<void>;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { notify, notifyError } = useNotifications();
  const [pickerRevision, setPickerRevision] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removing, setRemoving] = useState<{
    service: BookingService;
    expectedBookingUpdatedAt: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editable =
    !disabled &&
    ["under_review", "needs_details", "accepted"].includes(booking.status);

  const offered = booking.requestedServices.filter((service) => service.offer);

  const requested = booking.requestedServices.filter(
    (service) => !service.offer && !service.included && service.serviceId,
  );

  async function save() {
    if (!editor || busy || !editable) return;

    const pricing = {
      fixedPricePesos: editor.pricing.fixedPricePesos,
      includedHours: editor.pricing.includedHours,
      hourlyRatePesos: editor.pricing.hourlyRatePesos,
    };

    if (
      !servicePricingSchema.safeParse(pricing).success ||
      (editor.totalHours !== null &&
        (!Number.isSafeInteger(editor.totalHours) ||
          editor.totalHours < 1 ||
          editor.totalHours > MAX_BOOKING_ADDON_HOURS))
    ) {
      setError(
        "Enter valid pricing and a positive whole number of hours, or leave hours blank.",
      );

      return;
    }

    setBusy(true);
    onBusyChange?.(true);
    setError("");

    try {
      const body = {
        expectedBookingUpdatedAt: editor.expectedBookingUpdatedAt,
        totalHours: editor.totalHours,
        pricing,
      };
      const result = editor.addonId
        ? await updateBookingAddon(booking.id, editor.addonId, body)
        : await addBookingAddon(booking.id, {
            ...body,
            serviceId: editor.serviceId,
          });
      await onChanged(result.bookingRequest);
      setEditor(null);
      notify("Booking add-on saved.");
    } catch (cause) {
      setError(
        notifyError(
          cause,
          "Unable to save the booking add-on. Refresh the booking and try again.",
        ),
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  async function remove() {
    if (!removing?.service.id || busy || !editable) return;

    setBusy(true);
    onBusyChange?.(true);
    setError("");

    try {
      const result = await removeBookingAddon(
        booking.id,
        removing.service.id,
        removing.expectedBookingUpdatedAt,
      );
      await onChanged(result.bookingRequest);
      setRemoving(null);
      notify("Booking add-on removed.");
    } catch (cause) {
      setError(
        notifyError(
          cause,
          "Unable to remove the booking add-on. Refresh the booking and try again.",
        ),
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  const rows = offered.length + requested.length > 0;

  return (
    <section className="booking-addons">
      <h4>Services</h4>
      {rows ? (
        <ul className="booking-addon-list">
          {offered.map((service, index) => {
            if (!service.offer) return null;

            const amount = bookingOfferAmountLabel(service.offer);

            return (
              <li key={service.id ?? index} className="booking-addon-row">
                <div className="booking-addon-copy">
                  <strong>{service.name}</strong>
                  <span>{bookingHoursLabel(service.offer.totalHours)}</span>
                </div>
                {amount && (
                  <span className="booking-addon-amount">{amount}</span>
                )}
                {editable && service.id && service.serviceId && (
                  <div className="booking-addon-actions">
                    <Button
                      variant="secondary"
                      size="icon"
                      icon="edit"
                      aria-label={`Edit ${service.name}`}
                      title="Edit"
                      onClick={() => {
                        setError("");
                        setEditor({
                          serviceId: service.serviceId!,
                          addonId: service.id,
                          name: service.name,
                          pricing: service.offer!,
                          totalHours: service.offer!.totalHours,
                          expectedBookingUpdatedAt: booking.updatedAt,
                        });
                      }}
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      icon="trash"
                      aria-label={`Remove ${service.name}`}
                      title="Remove"
                      onClick={() => {
                        setError("");
                        setRemoving({
                          service,
                          expectedBookingUpdatedAt: booking.updatedAt,
                        });
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
          {requested.map((service, index) => (
            <li
              key={service.id ?? `request-${index}`}
              className="booking-addon-row"
            >
              <div className="booking-addon-copy">
                <strong>{service.name}</strong>
                <span>{bookingHoursLabel(service.hours)} · For review</span>
              </div>
              {editable && (
                <Button
                  variant="secondary"
                  size="small"
                  aria-label={`Add ${service.name}`}
                  onClick={async () => {
                    if (!service.serviceId) return;

                    setError("");

                    try {
                      const pricing =
                        service.catalogPricing ??
                        (await getAdminService(service.serviceId));
                      setEditor({
                        serviceId: service.serviceId,
                        name: service.name,
                        addonId: service.id,
                        pricing,
                        totalHours: service.hours,
                        expectedBookingUpdatedAt: booking.updatedAt,
                      });
                    } catch (cause) {
                      setError(
                        notifyError(cause, "Unable to load service pricing."),
                      );
                    }
                  }}
                >
                  Add
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="booking-addon-empty">No services yet.</p>
      )}
      {editable && (
        <Button
          variant="secondary"
          size="small"
          icon="plus"
          onClick={() => setPickerRevision(booking.updatedAt)}
        >
          Add service
        </Button>
      )}
      {error && !editor && !removing && <p role="alert">{error}</p>}
      {pickerRevision && (
        <CatalogReferencePickerDialog
          kind="service"
          caption=""
          hideCaption
          onCaptionChange={() => {}}
          onClose={() => setPickerRevision(null)}
          onSelect={(service) => {
            setPickerRevision(null);

            if (!service.pricing) return;

            setError("");
            setEditor({
              serviceId: service.id,
              name: service.name,
              pricing: service.pricing,
              totalHours: null,
              expectedBookingUpdatedAt: pickerRevision,
            });
          }}
        />
      )}
      {editor && (
        <Dialog
          title={editor.name}
          intro="Set the price and hours. Leave hours blank if they are still open."
          onClose={() => {
            if (!busy) setEditor(null);
          }}
          actions={
            <>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={!editable}
                pending={busy}
                onClick={() => void save()}
              >
                Save add-on
              </Button>
            </>
          }
        >
          <fieldset className="form-grid" disabled={busy}>
            <ServicePricingFields
              content={editor.pricing}
              onChange={(pricing) => setEditor({ ...editor, pricing })}
            />
            <FormField label="Total hours">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="1"
                  max={MAX_BOOKING_ADDON_HOURS}
                  step="1"
                  value={editor.totalHours ?? ""}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      totalHours:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              )}
            </FormField>
          </fieldset>
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
      {removing && (
        <Dialog
          title={`Remove ${removing.service.name}?`}
          intro="This removes the offer from this booking."
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
          actions={
            <>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setRemoving(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!editable}
                pending={busy}
                onClick={() => void remove()}
              >
                Remove add-on
              </Button>
            </>
          }
        >
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
    </section>
  );
}
