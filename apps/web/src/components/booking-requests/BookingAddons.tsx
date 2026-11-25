import { Button, DataTable, Input } from "@event-management/ui";
import { MAX_BOOKING_ADDON_SERVICES } from "@event-management/contracts/limits/booking-requests";
import { MAX_BOOKING_ADDON_HOURS } from "@event-management/contracts/limits/booking-requests";
import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  getService,
  type PublicService,
} from "../../lib/data/catalog/services";
import type { PublicPackage } from "../../lib/data/catalog/packages";
import { servicePricingLabels } from "../../lib/utils/formatting/money";

import type { BookingAddon } from "../../lib/services/booking-requests/booking-draft";
import { BookingAddonServicePickerDialog } from "./BookingAddonServicePickerDialog";

export function includedServiceIds(item: PublicPackage | null) {
  return new Set(
    item?.sections.flatMap((section) =>
      section.widgets.flatMap((widget) =>
        widget.type === "service" && widget.serviceId
          ? [widget.serviceId.toLowerCase()]
          : [],
      ),
    ),
  );
}

export function validAddonHours(row: BookingAddon) {
  const fixed =
    row.service.fixedPricePesos != null && row.service.includedHours != null;

  return (
    /^\d+$/.test(row.hours) &&
    Number.isSafeInteger(Number(row.hours)) &&
    Number(row.hours) <= MAX_BOOKING_ADDON_HOURS &&
    (fixed
      ? Number(row.hours) >= 1 &&
        Number(row.hours) + (row.service.includedHours ?? 0) <=
          MAX_BOOKING_ADDON_HOURS
      : Number(row.hours) > 0)
  );
}

export function BookingAddons({
  item,
  rows,
  onChange,
  readOnly = false,
}: {
  item: PublicPackage | null;
  rows: BookingAddon[];
  onChange: Dispatch<SetStateAction<BookingAddon[]>>;
  readOnly?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const addService = useRef<HTMLButtonElement>(null);
  const inputPrefix = useId();
  const included = includedServiceIds(item);

  const update = (
    serviceId: string,
    change: (entry: BookingAddon) => BookingAddon,
  ) =>
    onChange((current) =>
      current.map((entry) =>
        entry.service.id === serviceId ? change(entry) : entry,
      ),
    );

  const refresh = async (row: BookingAddon) => {
    setLoading(true);
    setError("");

    try {
      const service = await getService(row.service.id);
      update(row.service.id, (entry) => {
        const nextHours = validAddonHours(entry)
          ? Number(entry.hours) +
            (entry.service.includedHours ?? 0) -
            (service.includedHours ?? 0)
          : -1;

        return {
          service,
          hours: nextHours < 0 ? "" : String(nextHours),
          needsReview: true,
          refreshed: true,
        };
      });
    } catch {
      setError(`${row.service.name} is unavailable. Remove it or try again.`);
    } finally {
      setLoading(false);
    }
  };

  const addSelectedService = (service: PublicService) => {
    if (included.has(service.id.toLowerCase())) return;

    if (
      rows.some(
        (row) => row.service.id.toLowerCase() === service.id.toLowerCase(),
      )
    ) {
      return;
    }

    if (service.hourlyRatePesos == null) return;

    if (rows.length >= MAX_BOOKING_ADDON_SERVICES) return;

    onChange((current) => [...current, { service, hours: "1" }]);
    requestAnimationFrame(() =>
      document.getElementById(`${inputPrefix}-${service.id}`)?.focus(),
    );
  };

  const isAddonSelected = (service: PublicService) =>
    rows.some(
      (row) => row.service.id.toLowerCase() === service.id.toLowerCase(),
    );

  return (
    <section className="pe-addons booking-addons">
      <h3>Add-on services</h3>
      <p className="pe-addons-help">
        Optional services for team review. Catalog prices are indicative.
      </p>
      {rows.length > 0 ? (
        <>
          <p className="booking-addon-scroll-note">
            Scroll the table horizontally to see all service details and
            actions.
          </p>
          <DataTable<BookingAddon>
            className="pe-addon-table"
            label="Requested add-on services"
            minWidth={560}
            rows={rows}
            rowKey={(row) => row.service.id}
            columns={[
              {
                key: "service",
                header: "Service",
                cell: (row) => (
                  <>
                    {row.service.name}
                    {included.has(row.service.id.toLowerCase()) ? (
                      <span>
                        {" "}
                        · Included in your package. Remove to continue.
                      </span>
                    ) : (
                      row.needsReview && <span> · Review required</span>
                    )}
                  </>
                ),
              },
              {
                key: "pricing",
                header: "Catalog pricing",
                cell: (row) => {
                  const labels = servicePricingLabels(row.service);

                  return (
                    <div className="pe-addon-pricing">
                      {labels.price}
                      {labels.excess && <span>{labels.excess}</span>}
                    </div>
                  );
                },
              },
              {
                key: "hours",
                header: "Excess hours",
                cell: (row) => {
                  const fixed =
                    row.service.fixedPricePesos != null &&
                    row.service.includedHours != null;

                  return readOnly ? (
                    fixed ? (
                      `${Number(row.hours) + (row.service.includedHours ?? 0)} total hours (${row.hours} excess)`
                    ) : (
                      `${row.hours} requested hours`
                    )
                  ) : (
                    <Input
                      id={`${inputPrefix}-${row.service.id}`}
                      className="booking-addon-hours-input"
                      variant="plain"
                      type="number"
                      min={1}
                      step={1}
                      max={MAX_BOOKING_ADDON_HOURS}
                      value={row.hours}
                      aria-invalid={!validAddonHours(row)}
                      aria-label={`${fixed ? "Excess" : "Requested"} hours for ${row.service.name}`}
                      onChange={(event) => {
                        const hours = event.target.value;
                        update(row.service.id, (entry) => ({
                          ...entry,
                          hours,
                        }));
                      }}
                    />
                  );
                },
              },
              {
                key: "actions",
                header: "Actions",
                cell: (row) =>
                  readOnly ? null : (
                    <div className="pe-addon-actions">
                      {row.needsReview && (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={loading}
                            onClick={() => void refresh(row)}
                          >
                            Refresh {row.service.name}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={
                              !row.refreshed ||
                              !validAddonHours(row) ||
                              included.has(row.service.id.toLowerCase()) ||
                              row.service.hourlyRatePesos == null
                            }
                            onClick={() =>
                              update(row.service.id, (entry) => ({
                                ...entry,
                                needsReview: false,
                              }))
                            }
                          >
                            Confirm {row.service.name}
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        icon="trash"
                        aria-label={`Remove ${row.service.name}`}
                        title={`Remove ${row.service.name}`}
                        onClick={() => {
                          onChange((current) =>
                            current.filter(
                              (entry) => entry.service.id !== row.service.id,
                            ),
                          );
                          requestAnimationFrame(() =>
                            addService.current?.focus(),
                          );
                        }}
                      />
                    </div>
                  ),
              },
            ]}
          />
        </>
      ) : (
        <p className="pe-addon-empty">No add-on services selected.</p>
      )}
      {!readOnly && (
        <Button
          ref={addService}
          type="button"
          variant="secondary"
          disabled={rows.length >= MAX_BOOKING_ADDON_SERVICES}
          onClick={() => setPickerOpen(true)}
        >
          Add service
        </Button>
      )}
      {pickerOpen && (
        <BookingAddonServicePickerDialog
          onClose={() => {
            setPickerOpen(false);
            requestAnimationFrame(() => addService.current?.focus());
          }}
          onSelect={addSelectedService}
          isItemSelected={isAddonSelected}
        />
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}