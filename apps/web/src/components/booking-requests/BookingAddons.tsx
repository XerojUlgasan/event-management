import { Button, DataTable, Input } from "@event-management/ui";
import { MAX_PACKAGE_ADDON_SERVICES } from "@event-management/contracts/catalog";
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
  getServices,
  type PublicService,
} from "../../lib/data/catalog/services";
import type { PublicPackage } from "../../lib/data/catalog/packages";
import { servicePricingLabels } from "../../lib/utils/formatting/money";

import type { BookingAddon } from "../../lib/services/booking-requests/booking-draft";

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
      ? Number(row.hours) >= 0 &&
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
  const [services, setServices] = useState<PublicService[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const addService = useRef<HTMLButtonElement>(null);
  const inputPrefix = useId();
  const included = includedServiceIds(item);
  const load = async (next?: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await getServices({
        limit: 20,
        ...(next ? { cursor: next } : {}),
      });
      setServices((current) =>
        next ? [...current, ...result.services] : result.services,
      );
      setCursor(result.nextCursor);
      setOpened(true);
    } catch {
      setError("Unable to load services. Please try again.");
    } finally {
      setLoading(false);
    }
  };
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
                    <label className="booking-addon-hours">
                      {fixed ? "Excess hours" : "Requested hours"}
                      <Input
                        id={`${inputPrefix}-${row.service.id}`}
                        type="number"
                        min={fixed ? 0 : 1}
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
                    </label>
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
        <>
          <Button
            ref={addService}
            type="button"
            variant="secondary"
            disabled={loading || rows.length >= MAX_PACKAGE_ADDON_SERVICES}
            onClick={() => (opened ? setOpened(false) : void load())}
          >
            {opened ? "Close services" : "Add service"}
          </Button>
          {opened && (
            <div className="booking-addon-picker">
              <ul>
                {services.map((service) => {
                  const selected = rows.some(
                    (row) =>
                      row.service.id.toLowerCase() === service.id.toLowerCase(),
                  );
                  const inPackage = included.has(service.id.toLowerCase());
                  const unavailable = service.hourlyRatePesos == null;
                  return (
                    <li key={service.id}>
                      {service.name}{" "}
                      {inPackage
                        ? "(included in package)"
                        : selected
                          ? "(selected)"
                          : unavailable
                            ? "(rate on request; use special requests)"
                            : ""}{" "}
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        aria-label={`Add ${service.name}`}
                        disabled={
                          inPackage ||
                          selected ||
                          unavailable ||
                          rows.length >= MAX_PACKAGE_ADDON_SERVICES
                        }
                        onClick={() => {
                          onChange((current) => [
                            ...current,
                            {
                              service,
                              hours:
                                service.fixedPricePesos != null &&
                                service.includedHours != null
                                  ? "0"
                                  : "",
                            },
                          ]);
                          requestAnimationFrame(() =>
                            document
                              .getElementById(`${inputPrefix}-${service.id}`)
                              ?.focus(),
                          );
                        }}
                      >
                        Add
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {cursor && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => void load(cursor)}
                >
                  Load more services
                </Button>
              )}
            </div>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
