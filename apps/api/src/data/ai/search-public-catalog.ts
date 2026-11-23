import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Filters = {
  catalogType: "package" | "service";
  minPricePesos?: number;
  maxPricePesos?: number;
  pax?: number;
  pricingType?: "fixed" | "hourly";
};

export async function searchPublicCatalogData(
  db: Transaction<DB>,
  input: Filters,
) {
  if (input.catalogType === "package") {
    let q = db
      .selectFrom("packages")
      .select(["id", "name", "slug", "description", "price", "max_guests"])
      .where("package_type", "=", "catalog")
      .where("archived_at", "is", null)
      .where("published_at", "is not", null);

    if (input.minPricePesos !== undefined)
      q = q.where("price", ">=", input.minPricePesos);

    if (input.maxPricePesos !== undefined)
      q = q.where("price", "<=", input.maxPricePesos);

    if (input.pax !== undefined) q = q.where("max_guests", ">=", input.pax);

    return (await q.execute()).map((row) => ({
      id: row.id,
      type: "package" as const,
      name: row.name,
      slug: row.slug,
      description: row.description,
      price: {
        type: "package" as const,
        amountPesos: row.price,
        unit: "per package" as const,
        currency: "PHP" as const,
      },
      capacity: row.max_guests,
    }));
  }

  let q = db
    .selectFrom("services")
    .select([
      "id",
      "name",
      "slug",
      "description",
      "fixed_price_pesos",
      "hourly_rate_pesos",
      "included_hours",
    ])
    .where("archived_at", "is", null);

  if (input.pricingType === "fixed")
    q = q.where("fixed_price_pesos", "is not", null);

  if (input.pricingType === "hourly")
    q = q.where("fixed_price_pesos", "is", null);

  const priceColumn =
    input.pricingType === "fixed" ? "fixed_price_pesos" : "hourly_rate_pesos";

  if (input.minPricePesos !== undefined)
    q = q.where(priceColumn, ">=", input.minPricePesos);

  if (input.maxPricePesos !== undefined)
    q = q.where(priceColumn, "<=", input.maxPricePesos);

  return (await q.execute()).map((row) => ({
    id: row.id,
    type: "service" as const,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price:
      row.fixed_price_pesos !== null
        ? {
            type: "fixed" as const,
            amountPesos: row.fixed_price_pesos,
            includedHours: row.included_hours,
            additionalHourlyRatePesos: row.hourly_rate_pesos,
            unit: "fixed" as const,
            currency: "PHP" as const,
          }
        : {
            type: "hourly" as const,
            amountPesos: row.hourly_rate_pesos,
            unit: "per hour" as const,
            currency: "PHP" as const,
          },
    capacity: null,
  }));
}
