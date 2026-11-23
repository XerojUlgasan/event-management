import { z } from "zod";
import { MAX_EMAIL_LENGTH } from "./limits/auth.js";

export const MAX_BUSINESS_SHORT_TEXT = 200;
export const MAX_BUSINESS_TEXT = 4000;
export const MAX_BUSINESS_URL = 2048;
export const MAX_BUSINESS_LINKS = 20;
export const MAX_BUSINESS_FAQS = 30;

const shortText = z.string().trim().max(MAX_BUSINESS_SHORT_TEXT).default("");

const text = z.string().trim().max(MAX_BUSINESS_TEXT).default("");

export const businessUrlSchema = z
  .string()
  .trim()
  .max(MAX_BUSINESS_URL)
  .refine((value) => {
    if (!value) return true;

    try {
      const url = new URL(value);

      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Enter a complete http or https URL without login details.")
  .default("");

const email = z
  .string()
  .trim()
  .max(MAX_EMAIL_LENGTH)
  .refine(
    (value) => !value || z.email().safeParse(value).success,
    "Enter a valid email address.",
  )
  .default("");

const timeZone = shortText.refine((value) => {
  if (!value) return true;

  try {
    new Intl.DateTimeFormat("en", { timeZone: value });

    return true;
  } catch {
    return false;
  }
}, "Enter an IANA timezone, such as Asia/Manila.");

export const businessInformationSchema = z.strictObject({
  about: z
    .strictObject({
      name: shortText,
      tagline: shortText,
      introduction: text,
      description: text,
      yearEstablished: shortText.refine(
        (value) => !value || /^\d{4}$/.test(value),
        "Enter a four-digit year.",
      ),
      logoUrl: businessUrlSchema,
      portfolioUrl: businessUrlSchema,
      reviewsUrl: businessUrlSchema,
      awardsAndAccreditations: text,
      languages: shortText,
    })
    .prefault({}),
  contact: z
    .strictObject({
      email,
      phone: shortText,
      alternatePhone: shortText,
      preferredContactMethod: shortText,
      website: businessUrlSchema,
      facebook: businessUrlSchema,
      messenger: businessUrlSchema,
      instagram: businessUrlSchema,
      twitter: businessUrlSchema,
      tiktok: businessUrlSchema,
      youtube: businessUrlSchema,
      linkedin: businessUrlSchema,
      whatsappNumber: shortText,
      whatsapp: businessUrlSchema,
    })
    .prefault({}),
  location: z
    .strictObject({
      address: text,
      city: shortText,
      province: shortText,
      postalCode: shortText,
      mapUrl: businessUrlSchema,
      landmarks: text,
      directions: text,
      serviceAreas: text,
      outOfTownAvailability: text,
      travelLimitations: text,
    })
    .prefault({}),
  hours: z
    .strictObject({
      timeZone,
      monday: shortText,
      tuesday: shortText,
      wednesday: shortText,
      thursday: shortText,
      friday: shortText,
      saturday: shortText,
      sunday: shortText,
      supportHours: text,
      holidayHours: text,
      visitingInformation: text,
      appointmentRequirements: text,
      consultationLocation: text,
      parking: text,
      accessibility: text,
    })
    .prefault({}),
  inquiries: z
    .strictObject({
      eventTypes: text,
      mainServices: text,
      specialties: text,
      customization: text,
      inquiryProcess: text,
      requiredInformation: text,
      consultationOptions: text,
      consultationFees: text,
      typicalResponseTime: shortText,
      advanceNotice: text,
      dateAvailability: text,
      quotationProcess: text,
      bookingConfirmation: text,
      existingEventContact: text,
      humanContact: text,
    })
    .prefault({}),
  policies: z
    .strictObject({
      cancellation: text,
      rescheduling: text,
      requirementChanges: text,
      minimumLeadTime: text,
      venueAndSetupRequirements: text,
      announcements: text,
    })
    .prefault({}),
  otherLinks: z
    .array(
      z.strictObject({
        label: z.string().trim().min(1).max(MAX_BUSINESS_SHORT_TEXT),
        url: businessUrlSchema.refine((value) => !!value, "Enter a URL."),
      }),
    )
    .max(MAX_BUSINESS_LINKS)
    .default([]),
  faqs: z
    .array(
      z.strictObject({
        question: z.string().trim().min(1).max(MAX_BUSINESS_SHORT_TEXT),
        answer: z.string().trim().min(1).max(MAX_BUSINESS_TEXT),
      }),
    )
    .max(MAX_BUSINESS_FAQS)
    .default([]),
});

export const businessInformationResponseSchema = z.strictObject({
  information: businessInformationSchema,
  updatedAt: z.iso.datetime().nullable(),
});

export const saveBusinessInformationSchema = z.strictObject({
  information: businessInformationSchema,
  expectedUpdatedAt: z.iso.datetime().nullable(),
});

export type BusinessInformation = z.infer<typeof businessInformationSchema>;

export type BusinessInformationResponse = z.infer<
  typeof businessInformationResponseSchema
>;

export type SaveBusinessInformation = z.infer<
  typeof saveBusinessInformationSchema
>;

export function emptyBusinessInformation(): BusinessInformation {
  return businessInformationSchema.parse({});
}
