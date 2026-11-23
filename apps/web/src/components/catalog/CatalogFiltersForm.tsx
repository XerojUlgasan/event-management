import { useEffect, useState, type SubmitEvent } from "react";
import {
  MAX_CATALOG_FILTER_GUESTS,
  MAX_CATALOG_FILTER_PRICE_PESOS,
  type CatalogFilters,
  type CatalogKind,
  type EventType,
  type ServicePricingType,
} from "@event-management/contracts/catalog-filters";
import { Button, FormField, Input, Select } from "@event-management/ui";
import { pageQuery } from "../../lib/data/catalog/page-query";
import { EventTypeField } from "./EventTypeField";

/** Catalog-specific composition; shared controls own presentation and feedback. */
export function CatalogFiltersForm({
  kind,
  filters,
  action,
  onApply,
}: {
  kind: CatalogKind;
  filters: CatalogFilters;
} & (
  | { action: string; onApply?: never }
  | { action?: never; onApply: (filters: CatalogFilters) => void }
)) {
  const [minPrice, setMinPrice] = useState(
    filters.minPricePesos?.toString() ?? "",
  );
  const [maxPrice, setMaxPrice] = useState(
    filters.maxPricePesos?.toString() ?? "",
  );
  const [guests, setGuests] = useState(filters.guests?.toString() ?? "");
  const [pricingType, setPricingType] = useState<ServicePricingType | "">(
    filters.pricingType ?? "",
  );
  const [eventType, setEventType] = useState<EventType | "">(
    filters.eventType ?? "",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (!action) return;
    // Back can restore the live page with a draft that no longer matches its URL.
    const restoreAppliedFilters = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setMinPrice(filters.minPricePesos?.toString() ?? "");
      setMaxPrice(filters.maxPricePesos?.toString() ?? "");
      setGuests(filters.guests?.toString() ?? "");
      setPricingType(filters.pricingType ?? "");
      setEventType(filters.eventType ?? "");
      setError("");
    };
    window.addEventListener("pageshow", restoreAppliedFilters);
    return () => window.removeEventListener("pageshow", restoreAppliedFilters);
  }, [action, filters]);

  const hasPrice = kind === "packages" || pricingType !== "";
  const hasGuests = kind !== "services";
  const apply = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      hasPrice &&
      minPrice &&
      maxPrice &&
      Number(minPrice) > Number(maxPrice)
    ) {
      setError("Maximum price must be at least the minimum price.");
      return;
    }
    setError("");
    const next: CatalogFilters = {
      ...(eventType !== "" ? { eventType } : {}),
      ...(kind === "services" && pricingType !== "" ? { pricingType } : {}),
      ...(hasPrice && minPrice !== ""
        ? { minPricePesos: Number(minPrice) }
        : {}),
      ...(hasPrice && maxPrice !== ""
        ? { maxPricePesos: Number(maxPrice) }
        : {}),
      ...(hasGuests && guests !== "" ? { guests: Number(guests) } : {}),
    };
    if (onApply) onApply(next);
    else window.location.assign(action + pageQuery(next));
  };
  return (
    <form
      className="catalog-filters"
      aria-label={`Filter ${kind}`}
      action={action}
      method={action ? "get" : undefined}
      autoComplete={action ? "off" : undefined}
      onSubmit={apply}
      onReset={() => {
        setMinPrice("");
        setMaxPrice("");
        setGuests("");
        setPricingType("");
        setEventType("");
        setError("");
        onApply?.({});
      }}
    >
      <div className="catalog-filter-fields">
        <EventTypeField
          name="eventType"
          value={eventType}
          onChange={setEventType}
        />
        {kind === "services" && (
          <FormField
            label="Pricing type"
            description={
              action ? undefined : "Choose a type to filter its price range."
            }
          >
            {(field) => (
              <Select
                {...field}
                name="pricingType"
                value={pricingType}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "" || value === "fixed" || value === "hourly") {
                    setPricingType(value);
                    setMinPrice("");
                    setMaxPrice("");
                    setError("");
                  }
                }}
              >
                <option value="">All service pricing</option>
                <option value="fixed">Fixed price + excess hours</option>
                <option value="hourly">Hourly only</option>
              </Select>
            )}
          </FormField>
        )}
        {hasPrice && (
          <>
            {action && kind === "services" && (
              <input type="hidden" name="priceRangeType" value={pricingType} />
            )}
            <FormField
              label={
                kind === "services"
                  ? pricingType === "fixed"
                    ? "Min fixed price (₱)"
                    : "Min hourly rate (₱)"
                  : "Min price (₱)"
              }
            >
              {(field) => (
                <Input
                  {...field}
                  name="minPricePesos"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_CATALOG_FILTER_PRICE_PESOS}
                  step={1}
                  placeholder="No minimum"
                  value={minPrice}
                  onChange={(event) => {
                    setMinPrice(event.target.value);
                    setError("");
                  }}
                />
              )}
            </FormField>
            <FormField
              label={
                kind === "services"
                  ? pricingType === "fixed"
                    ? "Max fixed price (₱)"
                    : "Max hourly rate (₱)"
                  : "Max price (₱)"
              }
              error={error}
            >
              {(field) => (
                <Input
                  {...field}
                  name="maxPricePesos"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_CATALOG_FILTER_PRICE_PESOS}
                  step={1}
                  placeholder="No maximum"
                  value={maxPrice}
                  onChange={(event) => {
                    setMaxPrice(event.target.value);
                    setError("");
                  }}
                />
              )}
            </FormField>
          </>
        )}
        {hasGuests && (
          <FormField label="Number of guests">
            {(field) => (
              <Input
                {...field}
                name="guests"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_CATALOG_FILTER_GUESTS}
                step={1}
                placeholder="Any guest count"
                value={guests}
                onChange={(event) => setGuests(event.target.value)}
              />
            )}
          </FormField>
        )}
        <div className="catalog-filter-actions">
          <Button type="submit">Apply filters</Button>
          {action ? (
            <a className="button button-secondary" href={action}>
              Clear
            </a>
          ) : (
            <Button
              type="reset"
              variant="secondary"
              disabled={
                !minPrice &&
                !maxPrice &&
                !guests &&
                !pricingType &&
                !eventType &&
                !Object.keys(filters).length
              }
            >
              Clear
            </Button>
          )}
        </div>
      </div>
      <p className="catalog-filter-hint">
        {kind === "packages"
          ? "Prices are package totals. Enter your guest count to see packages that can fit your event."
          : pricingType === "fixed"
            ? "Filter the fixed price covering the listed hours. Excess hourly rates are shown separately."
            : pricingType === "hourly"
              ? "Filter hourly-only services by their hourly rate. Services without a listed rate are excluded when filtering by price."
              : "Choose fixed-price or hourly-only services to filter prices separately."}
      </p>
    </form>
  );
}
