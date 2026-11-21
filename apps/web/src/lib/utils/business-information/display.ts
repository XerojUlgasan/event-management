import type { BusinessInformation } from "@event-management/contracts/business-information";
import {
  MAX_BUSINESS_SHORT_TEXT,
  MAX_BUSINESS_TEXT,
  MAX_BUSINESS_URL,
} from "@event-management/contracts/business-information";
import { MAX_EMAIL_LENGTH } from "@event-management/contracts/limits/auth";

export type BusinessInformationGroupKey = keyof Omit<
  BusinessInformation,
  "otherLinks" | "faqs"
>;

const MULTILINE_GROUPS: Record<BusinessInformationGroupKey, Set<string>> = {
  contact: new Set(),
  about: new Set(["introduction", "description", "awardsAndAccreditations"]),
  location: new Set([
    "address",
    "landmarks",
    "directions",
    "serviceAreas",
    "outOfTownAvailability",
    "travelLimitations",
  ]),
  hours: new Set([
    "supportHours",
    "holidayHours",
    "visitingInformation",
    "appointmentRequirements",
    "consultationLocation",
    "parking",
    "accessibility",
  ]),
  inquiries: new Set([
    "eventTypes",
    "mainServices",
    "specialties",
    "customization",
    "inquiryProcess",
    "requiredInformation",
    "consultationOptions",
    "consultationFees",
    "advanceNotice",
    "dateAvailability",
    "quotationProcess",
    "bookingConfirmation",
    "existingEventContact",
    "humanContact",
  ]),
  policies: new Set([
    "cancellation",
    "rescheduling",
    "requirementChanges",
    "minimumLeadTime",
    "venueAndSetupRequirements",
    "announcements",
  ]),
};

const URL_FIELDS: Record<BusinessInformationGroupKey, Set<string>> = {
  about: new Set(["logoUrl", "portfolioUrl", "reviewsUrl"]),
  contact: new Set([
    "website",
    "facebook",
    "messenger",
    "instagram",
    "twitter",
    "tiktok",
    "youtube",
    "linkedin",
    "whatsapp",
  ]),
  location: new Set(["mapUrl"]),
  hours: new Set(),
  inquiries: new Set(),
  policies: new Set(),
};

export function isMultilineField(
  group: BusinessInformationGroupKey,
  field: string,
): boolean {
  return MULTILINE_GROUPS[group]?.has(field) ?? false;
}

export function isBusinessUrlField(
  group: BusinessInformationGroupKey,
  field: string,
): boolean {
  return URL_FIELDS[group]?.has(field) ?? false;
}

export function businessFieldMaxLength(
  group: BusinessInformationGroupKey,
  field: string,
): number {
  if (field === "email") return MAX_EMAIL_LENGTH;

  if (isBusinessUrlField(group, field)) return MAX_BUSINESS_URL;

  if (isMultilineField(group, field)) return MAX_BUSINESS_TEXT;

  return MAX_BUSINESS_SHORT_TEXT;
}

export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");

  if (!digits || digits === "+") return null;

  return `tel:${digits}`;
}

export function businessInformationIsEmpty(
  information: BusinessInformation,
): boolean {
  return !BUSINESS_INFORMATION_GROUPS.some(({ key, fields }) =>
    Object.entries(information[key]).some(
      ([field, value]) =>
        (fields as readonly string[]).includes(field) && Boolean(value?.trim()),
    ),
  );
}

export const BUSINESS_INFORMATION_GROUPS = [
  { key: "about", title: "About", fields: ["name", "introduction"] },
  {
    key: "contact",
    title: "Contact",
    fields: ["phone", "email", "facebook", "instagram"],
  },
  {
    key: "location",
    title: "Location",
    fields: ["address", "mapUrl", "serviceAreas"],
  },
  { key: "hours", title: "Opening hours", fields: ["supportHours"] },
] as const satisfies {
  key: BusinessInformationGroupKey;
  title: string;
  fields: readonly string[];
}[];
