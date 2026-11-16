import { useState, type SubmitEvent } from "react";
import {
  MAX_CATALOG_FILTER_GUESTS,
  MAX_CATALOG_FILTER_PRICE_PESOS,
  type CatalogFilters,
  type CatalogKind,
  type ServicePricingType,
} from "@event-management/contracts/catalog-filters";
import { Button, FormField, Input, Select } from "@event-management/ui";

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
  const [error, setError] = useState("");
  const hasPrice = kind === "packages" || pricingType !== "";
  const hasGuests = kind !== "services";
  const apply = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setError("Maximum price must be at least the minimum price.");
      return;
    }
    setError("");
    onApply({
      ...(kind === "services" && pricingType !== "" ? { pricingType } : {}),
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
        setPricingType("");
        setError("");
        onApply({});
      }}
    >
      <div className="catalog-filter-fields">
        {kind === "services" && (
          <FormField
            label="Pricing type"
            description="Choose a type to filter its price range."
          >
            {(field) => (
              <Select
                {...field}
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
              !minPrice &&
              !maxPrice &&
              !guests &&
              !pricingType &&
              !Object.keys(filters).length
            }
          >
            Clear
          </Button>
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
