import { useState, type SubmitEvent } from "react";
import {
  MAX_CATALOG_FILTER_GUESTS,
  MAX_CATALOG_FILTER_PRICE_PESOS,
  type CatalogFilters,
  type CatalogKind,
} from "@event-management/contracts/catalog-filters";
import { Button, FormField, Input } from "@event-management/ui";

/** Catalog-specific composition; shared controls own presentation and feedback. */
export function CatalogFiltersForm({
  kind,
  filters,
  onApply,
}: {
  kind: CatalogKind;
  filters: CatalogFilters;
  onApply: (filters: CatalogFilters) => void;
}) {
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [guests, setGuests] = useState("");
  const [error, setError] = useState("");
  const hasPrice = kind !== "venues";
  const hasGuests = kind !== "services";
  const apply = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setError("Maximum price must be at least the minimum price.");
      return;
    }
    setError("");
    onApply({
      ...(hasPrice && minPrice !== ""
        ? { minPricePesos: Number(minPrice) }
        : {}),
      ...(hasPrice && maxPrice !== ""
        ? { maxPricePesos: Number(maxPrice) }
        : {}),
      ...(hasGuests && guests !== "" ? { guests: Number(guests) } : {}),
    });
  };
  return (
    <form
      className="catalog-filters"
      aria-label={`Filter ${kind}`}
      onSubmit={apply}
      onReset={() => {
        setMinPrice("");
        setMaxPrice("");
        setGuests("");
        setError("");
        onApply({});
      }}
    >
      <div className="catalog-filter-fields">
        {hasPrice && (
          <>
            <FormField
              label={
                kind === "services" ? "Min hourly rate (₱)" : "Min price (₱)"
              }
            >
              {(field) => (
                <Input
                  {...field}
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
                kind === "services" ? "Max hourly rate (₱)" : "Max price (₱)"
              }
              error={error}
            >
              {(field) => (
                <Input
                  {...field}
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
          <Button
            type="reset"
            variant="secondary"
            disabled={
              !minPrice && !maxPrice && !guests && !Object.keys(filters).length
            }
          >
            Clear
          </Button>
        </div>
      </div>
      <p className="catalog-filter-hint">
        {kind === "packages"
          ? "Prices are package totals. Enter your guest count to see packages that can fit your event."
          : kind === "services"
            ? "Rates are per hour, not the total event price. Services without a listed rate are excluded when filtering by price."
            : "Enter your guest count to see venues that can fit your event. Venues without a listed capacity are excluded when filtering."}
      </p>
    </form>
  );
}
