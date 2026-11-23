import {
  businessInformationSchema,
  emptyBusinessInformation,
  saveBusinessInformationSchema,
  MAX_BUSINESS_FAQS,
  MAX_BUSINESS_LINKS,
  MAX_BUSINESS_SHORT_TEXT,
  MAX_BUSINESS_TEXT,
  MAX_BUSINESS_URL,
  type BusinessInformation,
  type SaveBusinessInformation,
} from "@event-management/contracts/business-information";

/** JSON.stringify expands U+0001 to six-byte \\u0001 sequences per code unit. */
const JSON_ESCAPE_CHAR = "\u0001";

const urlPrefix = "https://example.test/";

const urlAtMax = `${urlPrefix}${"a".repeat(MAX_BUSINESS_URL - urlPrefix.length)}`;

export function buildMaximalValidBusinessInformation(): BusinessInformation {
  const base = emptyBusinessInformation();
  const short = JSON_ESCAPE_CHAR.repeat(MAX_BUSINESS_SHORT_TEXT);
  const text = JSON_ESCAPE_CHAR.repeat(MAX_BUSINESS_TEXT);

  return businessInformationSchema.parse({
    about: {
      ...base.about,
      name: short,
      tagline: short,
      introduction: text,
      description: text,
      yearEstablished: "2024",
      logoUrl: urlAtMax,
      portfolioUrl: urlAtMax,
      reviewsUrl: urlAtMax,
      awardsAndAccreditations: text,
      languages: short,
    },
    contact: {
      ...base.contact,
      email: `${"e".repeat(241)}@example.test`,
      phone: short,
      alternatePhone: short,
      preferredContactMethod: short,
      website: urlAtMax,
      facebook: urlAtMax,
      messenger: urlAtMax,
      instagram: urlAtMax,
      twitter: urlAtMax,
      tiktok: urlAtMax,
      youtube: urlAtMax,
      linkedin: urlAtMax,
      whatsappNumber: short,
      whatsapp: urlAtMax,
    },
    location: {
      ...base.location,
      address: text,
      city: short,
      province: short,
      postalCode: short,
      mapUrl: urlAtMax,
      landmarks: text,
      directions: text,
      serviceAreas: text,
      outOfTownAvailability: text,
      travelLimitations: text,
    },
    hours: {
      ...base.hours,
      timeZone: "Asia/Manila",
      monday: short,
      tuesday: short,
      wednesday: short,
      thursday: short,
      friday: short,
      saturday: short,
      sunday: short,
      supportHours: text,
      holidayHours: text,
      visitingInformation: text,
      appointmentRequirements: text,
      consultationLocation: text,
      parking: text,
      accessibility: text,
    },
    inquiries: {
      ...base.inquiries,
      eventTypes: text,
      mainServices: text,
      specialties: text,
      customization: text,
      inquiryProcess: text,
      requiredInformation: text,
      consultationOptions: text,
      consultationFees: text,
      typicalResponseTime: short,
      advanceNotice: text,
      dateAvailability: text,
      quotationProcess: text,
      bookingConfirmation: text,
      existingEventContact: text,
      humanContact: text,
    },
    policies: {
      ...base.policies,
      cancellation: text,
      rescheduling: text,
      requirementChanges: text,
      minimumLeadTime: text,
      venueAndSetupRequirements: text,
      announcements: text,
    },
    otherLinks: Array.from({ length: MAX_BUSINESS_LINKS }, () => ({
      label: short,
      url: urlAtMax,
    })),
    faqs: Array.from({ length: MAX_BUSINESS_FAQS }, () => ({
      question: short,
      answer: text,
    })),
  });
}

export function buildMaximalValidBusinessInformationSaveBody(
  expectedUpdatedAt: string,
): SaveBusinessInformation {
  return saveBusinessInformationSchema.parse({
    information: buildMaximalValidBusinessInformation(),
    expectedUpdatedAt,
  });
}

export const WORST_CASE_VALID_BUSINESS_INFORMATION_SAVE_BYTES =
  Buffer.byteLength(
    JSON.stringify(
      buildMaximalValidBusinessInformationSaveBody(new Date(0).toISOString()),
    ),
    "utf8",
  );
