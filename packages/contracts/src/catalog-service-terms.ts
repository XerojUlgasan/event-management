import { z } from "zod";
import { MAX_PACKAGE_ADDON_SERVICES } from "@event-management/contracts/catalog";

const positiveWholeNumber = z.number().int().positive().max(2147483647);

export const includedServiceTermsSchema = z
  .object({
    includedHours: positiveWholeNumber.nullable(),
    hourlyRatePesos: positiveWholeNumber.nullable(),
  })
  .strict();

export const servicePricingSchema = z
  .object({
    hourlyRatePesos: positiveWholeNumber,
    fixedPricePesos: positiveWholeNumber.nullable(),
    includedHours: positiveWholeNumber.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      (value.fixedPricePesos === null) === (value.includedHours === null),
    { message: "Fixed price and included hours must be provided together" },
  );

export const packageAddonServiceSchema = servicePricingSchema.safeExtend({
  id: z.string().uuid(),
  serviceId: z.string().uuid(),
  service: z
    .object({
      id: z.string().uuid(),
      slug: z.string(),
      name: z.string(),
      description: z.string(),
      imageUrl: z.string().nullable(),
    })
    .strict()
    .nullable()
    .optional(),
});

export const packageAddonServicesSchema = z
  .array(packageAddonServiceSchema)
  .max(MAX_PACKAGE_ADDON_SERVICES)
  .superRefine((addons, ctx) => {
    for (const field of ["id", "serviceId"] as const) {
      const values = addons.map((addon) => addon[field].toLowerCase());

      if (new Set(values).size !== values.length)
        ctx.addIssue({
          code: "custom",
          message: `Add-on ${field} values must be unique`,
        });
    }
  });
