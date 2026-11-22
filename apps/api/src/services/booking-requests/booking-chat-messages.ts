import type { BookingDraftFields } from "@event-management/contracts/booking-draft";
import { z } from "zod";
import type { resolveBookingDraft } from "./resolve-booking-draft.js";

const plainText = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(/^[^\r\n\p{N}\p{Sc}]+$/u);

const copyText = plainText.regex(/^[^?¿؟？]+$/u);

const template = (placeholder: string) =>
  copyText.refine((value) => {
    const parts = value.split(placeholder);

    return parts.length === 2 && !/\[\[|\]\]/u.test(parts.join(""));
  });

export const bookingReviewCopySchema = z.object({
  introduction: copyText,
  event: copyText,
  duration: copyText,
  oneDay: copyText,
  multipleDays: copyText,
  dates: copyText,
  timeZone: copyText,
  contact: copyText,
  phone: copyText,
  guestCount: copyText,
  location: copyText,
  package: copyText,
  packageCapacity: template("[[capacity]]"),
  noPackage: copyText,
  budget: copyText,
  specialRequests: copyText,
  services: copyText,
  oneHour: template("[[hours]]"),
  multipleHours: template("[[hours]]"),
  included: copyText,
  capacityWarning: template("[[capacity]]"),
  signIn: copyText,
  confirmation: plainText.regex(/^¿?[^?¿؟？]+[?؟？]$/u),
  corrections: copyText,
});

export type BookingReviewCopy = z.infer<typeof bookingReviewCopySchema>;

const englishBookingReviewCopy: BookingReviewCopy = {
  introduction: "Please review your booking request.",
  event: "Event",
  duration: "Duration",
  oneDay: "One day",
  multipleDays: "Multiple days",
  dates: "Requested dates",
  timeZone: "Event time zone",
  contact: "Contact name",
  phone: "Phone",
  guestCount: "Guest count",
  location: "Preferred location",
  package: "Package",
  packageCapacity: "up to [[capacity]] guests",
  noPackage: "No package selected",
  budget: "Budget",
  specialRequests: "Special requests",
  services: "Requested services",
  oneHour: "[[hours]] hour",
  multipleHours: "[[hours]] hours",
  included: "Included in package",
  capacityWarning:
    "Your guest count exceeds this package’s listed capacity of [[capacity]]. AMAC will review the fit.",
  signIn: "Sign in to continue and review the request again before submitting.",
  confirmation: "Should I send this request to AMAC for review?",
  corrections: "If anything needs changing, tell me what to update.",
};

export const bookingChatStyleSchema = z.enum(["en", "taglish", "fil", "other"]);

export const bookingReviewPresets = {
  en: englishBookingReviewCopy,
  taglish: {
    ...englishBookingReviewCopy,
    introduction: "Ito yung details ng booking request mo.",
    dates: "Event dates",
    phone: "Phone number",
    guestCount: "Guests",
    location: "Preferred venue",
    packageCapacity: "hanggang [[capacity]] guests",
    noPackage: "Walang napiling package",
    included: "Kasama sa package",
    capacityWarning:
      "Mas marami ang guests mo kaysa sa capacity na [[capacity]]. Iche-check ng AMAC team kung fit yung package.",
    signIn: "Mag-sign in muna para ma-check mo ulit ang details bago i-send.",
    confirmation: "I-send ko na sa AMAC team para ma-review?",
    corrections: "Sabihin mo lang kung may papalitan.",
  },
  fil: {
    introduction:
      "Heto ang mga detalye ng request mo. Tingnan mo kung tama lahat.",
    event: "Okasyon",
    duration: "Tagal",
    oneDay: "Isang araw",
    multipleDays: "Ilang araw",
    dates: "Mga petsang gusto mo",
    timeZone: "Time zone ng event",
    contact: "Pangalan ng contact",
    phone: "Numero ng telepono",
    guestCount: "Dami ng bisita",
    location: "Lugar na gusto mo",
    package: "Package",
    packageCapacity: "hanggang [[capacity]] bisita",
    noPackage: "Walang napiling package",
    budget: "Badyet",
    specialRequests: "Iba pang gusto mo",
    services: "Mga serbisyong gusto mo",
    oneHour: "[[hours]] oras",
    multipleHours: "[[hours]] oras",
    included: "Kasama sa package",
    capacityWarning:
      "Lampas sa [[capacity]] ang dami ng bisita mo. Titingnan ng AMAC team kung kasya sa package.",
    signIn:
      "Mag-sign in muna para matingnan mo ulit ang mga detalye bago ipadala.",
    confirmation: "Ipadala ko na ba ito sa AMAC para matingnan nila?",
    corrections: "Sabihin mo lang kung may papalitan.",
  },
} satisfies Record<
  Exclude<z.infer<typeof bookingChatStyleSchema>, "other">,
  BookingReviewCopy
>;

export const bookingReceiptModelCopySchema = z.object({
  style: bookingChatStyleSchema.optional(),
  receipt: z.string().nullable().optional(),
  changesGuidance: z.string().nullable().optional(),
});

export type BookingReceiptCopy = z.infer<typeof bookingReceiptModelCopySchema>;

export const bookingReceiptTemplateSchema = template("[[reference]]");

export const englishBookingReceiptTemplate =
  "Booking request [[reference]] submitted for AMAC review. Your requested dates are preferences.";

export const englishBookingChangesGuidance =
  "For package or add-on changes, message AMAC staff here in this chat.";

const receiptPresets = {
  en: `${englishBookingReceiptTemplate} ${englishBookingChangesGuidance}`,
  taglish:
    "Na-send na sa AMAC team ang booking request [[reference]] para ma-review. Preferred dates pa lang yung nilagay mo. Para sa changes sa package o add-ons, i-message ang AMAC staff dito sa chat na ito.",
  fil: "Naipadala na sa AMAC ang request [[reference]] para matingnan ng team. Mga gusto mong petsa pa lang ang nakalagay. Para sa pagbabago sa package o add-ons, mag-message sa AMAC staff dito sa chat na ito.",
};

function quoteBookingChatText(value: string | number) {
  return String(value)
    .replace(/[!#&()*+\-.<>[\]_`|~\\]/gu, "\\$&")
    .replace(/\r?\n/gu, "  \n  ");
}

export function bookingRequestReceipt(
  reference: string,
  copy?: BookingReceiptCopy,
) {
  const style = copy?.style ?? "other";
  const changesGuidance = copy?.changesGuidance
    ? copyText.safeParse(copy.changesGuidance).data
    : undefined;
  const receipt =
    style === "other"
      ? `${bookingReceiptTemplateSchema.parse(copy?.receipt)} ${changesGuidance ?? englishBookingChangesGuidance}`
      : receiptPresets[style];

  return quoteBookingChatText(receipt).replace(
    quoteBookingChatText("[[reference]]"),
    () => reference,
  );
}

type ReviewedDetails = Pick<
  Awaited<ReturnType<typeof resolveBookingDraft>>,
  "selectedPackage" | "requestedServices" | "outOfRange"
>;

export function bookingReviewBody(
  fields: BookingDraftFields,
  resolved: ReviewedDetails,
  guest: boolean,
  copy: BookingReviewCopy,
) {
  const { selectedPackage, requestedServices, outOfRange } = resolved;
  const quote = quoteBookingChatText;

  const line = (label: string, value: string | number) =>
    `- **${quote(label)}** · ${quote(value)}`;

  const lines = [
    quote(copy.introduction),
    "",
    line(copy.event, fields.eventType!),
    line(
      copy.duration,
      fields.durationMode === "one_day" ? copy.oneDay : copy.multipleDays,
    ),
    line(copy.dates, fields.requestedDates!.join(", ")),
    line(copy.timeZone, fields.timeZone!),
    line(copy.contact, fields.contactName!),
    line(copy.phone, fields.phoneNumber!),
    ...(fields.guestCount ? [line(copy.guestCount, fields.guestCount)] : []),
    ...(fields.preferredVenueLocation
      ? [line(copy.location, fields.preferredVenueLocation)]
      : []),
    line(
      copy.package,
      selectedPackage
        ? `${selectedPackage.name} · ₱${selectedPackage.price.toLocaleString("en-PH")} · ${copy.packageCapacity.replace("[[capacity]]", String(selectedPackage.maxGuests))}`
        : copy.noPackage,
    ),
    ...(fields.budget ? [line(copy.budget, fields.budget)] : []),
    ...(fields.specialRequests
      ? [line(copy.specialRequests, fields.specialRequests)]
      : []),
    ...(requestedServices.length
      ? [
          "",
          `**${quote(copy.services)}**`,
          ...requestedServices.map(({ name, hours, included, notes }) => {
            const duration = hours === 1 ? copy.oneHour : copy.multipleHours;
            const details = [name];

            if (hours !== null)
              details.push(duration.replace("[[hours]]", String(hours)));

            if (included) details.push(copy.included);

            if (notes) details.push(notes);

            return `- ${details.map(quote).join(" · ")}`;
          }),
        ]
      : []),
    ...(outOfRange && selectedPackage
      ? [
          "",
          quote(
            copy.capacityWarning.replace(
              "[[capacity]]",
              String(selectedPackage.maxGuests),
            ),
          ),
        ]
      : []),
    "",
    ...(guest
      ? [quote(copy.signIn)]
      : [quote(copy.corrections), quote(copy.confirmation)]),
  ];

  return lines.join("\n");
}
