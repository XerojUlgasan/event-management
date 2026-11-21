import { z } from "zod";
import { MAX_PACKAGE_ADDON_SERVICES } from "./catalog.js";
import { servicePricingSchema } from "./catalog-service-terms.js";
import {
  MAX_CONTACT_NAME_LENGTH,
  MAX_EVENT_TYPE_LENGTH,
  MAX_PHONE_NUMBER_LENGTH,
  MAX_PREFERRED_VENUE_LOCATION_LENGTH,
  MAX_SPECIAL_REQUESTS_LENGTH,
  MAX_TIME_ZONE_LENGTH,
} from "./limits/booking-requests.js";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !value.includes("\0"), "Invalid text");

const id = z.string().uuid().toLowerCase();

const guestCount = z.number().int().positive().max(2147483647);

const requestedDates = z
  .array(z.iso.date().refine((date) => !date.startsWith("0000-")))
  .max(366)
  .refine(
    (dates) => new Set(dates).size === dates.length,
    "Choose distinct requested dates",
  );

const timeZone = text(MAX_TIME_ZONE_LENGTH).refine((zone) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });

    return true;
  } catch {
    return false;
  }
}, "Invalid event time zone");

const serviceFields = {
  serviceId: id.optional(),
  customName: text(MAX_EVENT_TYPE_LENGTH).optional(),
  hours: z.number().positive().max(2147483647).optional(),
  notes: text(MAX_SPECIAL_REQUESTS_LENGTH).optional(),
};

const hasServiceIdentity = (item: {
  serviceId?: string;
  customName?: string;
}) => Boolean(item.serviceId) !== Boolean(item.customName);

const serviceIdentityError =
  "Supply a catalog service ID or a custom service name";

const serviceSchema = z
  .strictObject(serviceFields)
  .refine(hasServiceIdentity, serviceIdentityError);

const servicePatchSchema = z
  .strictObject({
    ...serviceFields,
    hours: serviceFields.hours.nullable(),
    notes: serviceFields.notes.nullable(),
  })
  .refine(hasServiceIdentity, serviceIdentityError);

const serviceList = z.array(serviceSchema).max(MAX_PACKAGE_ADDON_SERVICES);

const scalarFields = {
  eventType: text(MAX_EVENT_TYPE_LENGTH),
  durationMode: z.enum(["one_day", "multi_day"]),
  requestedDates,
  timeZone,
  guestCount,
  contactName: text(MAX_CONTACT_NAME_LENGTH),
  phoneNumber: text(MAX_PHONE_NUMBER_LENGTH),
  preferredVenueLocation: text(MAX_PREFERRED_VENUE_LOCATION_LENGTH),
  specialRequests: text(MAX_SPECIAL_REQUESTS_LENGTH),
  packageId: id,
  budget: text(MAX_EVENT_TYPE_LENGTH),
};

export const bookingDraftFieldsSchema = z
  .strictObject({ ...scalarFields, requestedServices: serviceList })
  .partial();

export type BookingDraftFields = z.infer<typeof bookingDraftFieldsSchema>;

export const bookingDraftPatchSchema = z
  .strictObject({
    eventType: scalarFields.eventType.nullable(),
    durationMode: scalarFields.durationMode.nullable(),
    requestedDates: requestedDates.nullable(),
    timeZone: timeZone.nullable(),
    guestCount: guestCount.nullable(),
    contactName: scalarFields.contactName.nullable(),
    phoneNumber: scalarFields.phoneNumber.nullable(),
    preferredVenueLocation: scalarFields.preferredVenueLocation.nullable(),
    specialRequests: scalarFields.specialRequests.nullable(),
    packageId: id.nullable(),
    budget: scalarFields.budget.nullable(),
    upsertServices: z.array(servicePatchSchema).max(MAX_PACKAGE_ADDON_SERVICES),
    removeServices: z
      .array(text(MAX_EVENT_TYPE_LENGTH))
      .max(MAX_PACKAGE_ADDON_SERVICES),
  })
  .partial();

export type BookingDraftPatch = z.infer<typeof bookingDraftPatchSchema>;

export function applyBookingDraftPatch(
  fields: BookingDraftFields,
  patch: BookingDraftPatch,
): BookingDraftFields {
  const { upsertServices = [], removeServices = [], ...changes } = patch;

  const next = bookingDraftFieldsSchema.parse(
    Object.fromEntries(
      Object.entries({ ...fields, ...changes }).filter(
        ([, value]) => value != null,
      ),
    ),
  );

  if (next.requestedDates) next.requestedDates.sort();

  const key = (
    service: Pick<z.infer<typeof serviceSchema>, "serviceId" | "customName">,
  ) => (service.serviceId ?? service.customName ?? "").toLowerCase();

  const services = new Map(
    (fields.requestedServices ?? []).map((item) => [key(item), item]),
  );

  for (const name of removeServices) services.delete(name.toLowerCase());

  for (const change of upsertServices) {
    const itemKey = key(change);
    const merged = { ...services.get(itemKey), ...change };
    services.set(
      itemKey,
      serviceSchema.parse({
        ...merged,
        hours: merged.hours ?? undefined,
        notes: merged.notes ?? undefined,
      }),
    );
  }

  if (services.size || fields.requestedServices || upsertServices.length)
    next.requestedServices = serviceList.parse([...services.values()]);

  return next;
}

export const reviewedServiceSchema = z.strictObject({
  serviceId: id.nullable(),
  name: z.string(),
  hours: z.number().nullable(),
  notes: z.string().nullable(),
  included: z.boolean(),
  updatedAt: z.string().nullable(),
  catalogPricing: servicePricingSchema.optional(),
});

export type ReviewedBookingService = z.infer<typeof reviewedServiceSchema>;
