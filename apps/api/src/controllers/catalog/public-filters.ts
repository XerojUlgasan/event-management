import { z } from "@hono/zod-openapi";
import {
  EVENT_TYPES,
  MAX_CATALOG_FILTER_GUESTS,
  MAX_CATALOG_FILTER_PRICE_PESOS,
} from "@event-management/contracts/catalog-filters";
import { MAX_CATALOG_SEARCH_LENGTH } from "@event-management/contracts/limits/catalog";
import { paginationQuerySchema } from "../../utils/pagination.js";

const eventType = z.enum(EVENT_TYPES).optional();

const integer = (minimum: number, maximum: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(minimum).max(maximum));

const price = integer(0, MAX_CATALOG_FILTER_PRICE_PESOS).optional();

const guests = integer(1, MAX_CATALOG_FILTER_GUESTS).optional();

const priceRange = <
  T extends { minPricePesos?: number; maxPricePesos?: number },
>(
  value: T,
) =>
  value.minPricePesos === undefined ||
  value.maxPricePesos === undefined ||
  value.minPricePesos <= value.maxPricePesos;

const rangeMessage = {
  message: "Minimum price must not exceed maximum price",
  path: ["minPricePesos"],
};

export const packageCatalogQuerySchema = paginationQuerySchema
  .extend({
    minPricePesos: price,
    maxPricePesos: price,
    guests,
    eventType,
    search: z
      .string()
      .trim()
      .max(MAX_CATALOG_SEARCH_LENGTH)
      .refine((value) => !value.includes("\0"), "Invalid search text")
      .optional(),
  })
  .refine(priceRange, rangeMessage);

export const serviceCatalogQuerySchema = paginationQuerySchema
  .extend({
    pricingType: z.enum(["fixed", "hourly"]).optional(),
    minPricePesos: price,
    maxPricePesos: price,
    eventType,
  })
  .strict()
  .refine(priceRange, rangeMessage)
  .refine(
    (value) =>
      value.pricingType !== undefined ||
      (value.minPricePesos === undefined && value.maxPricePesos === undefined),
    {
      message:
        "Choose fixed-price or hourly-only pricing before filtering by price",
      path: ["pricingType"],
    },
  );
