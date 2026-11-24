import { businessInformationSchema } from "@event-management/contracts/business-information";
import { sql } from "kysely";
import type { Json } from "../types.js";
import type { SeedDb } from "./context.js";

const demoBusinessInformation = businessInformationSchema.parse({
  about: {
    name: "Styled by AMAC",
    introduction:
      "Planning a garden wedding, a family debut, or a company gathering? Explore floral backdrops, reception styling, and on-the-day coordination. This demo profile uses illustrative contact details, location, and hours.",
    description:
      "From a sampaguita-accented ceremony to an intimate merienda reception, start with the atmosphere you want and the moments you want guests to remember.",
  },
  contact: {
    phone: "Phone inquiries unavailable",
    email: "hello@styled-by-amac.example.test",
    facebook: "https://styled-by-amac.example.test/facebook",
    instagram: "https://styled-by-amac.example.test/instagram",
    preferredContactMethod: "Send your inquiry through Messages.",
  },
  location: {
    address: "Quezon City, Metro Manila, Philippines",
    city: "Quezon City",
    province: "Metro Manila",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Quezon+City",
    serviceAreas: "Quezon City and nearby Metro Manila venues.",
    outOfTownAvailability:
      "For events outside Metro Manila, share the venue and dates so the team can review setup and travel needs.",
  },
  hours: {
    timeZone: "Asia/Manila",
    supportHours:
      "Tuesday to Saturday, 10:00 AM–6:00 PM (Philippine time). Sunday and Monday closed.",
    visitingInformation:
      "Start in Messages and tell us where you plan to hold the event.",
  },
  inquiries: {
    eventTypes: "Weddings, debuts, birthdays, and company gatherings.",
    mainServices:
      "Ceremony backdrops, reception and table styling, and on-the-day coordination.",
    customization:
      "Start with a published package or describe the event you have in mind. An administrator can discuss changes and prepare a private custom package.",
    inquiryProcess:
      "Browse packages or start in Messages, then sign in to review and submit a booking request. The team follows up in the linked conversation.",
    requiredInformation:
      "Share the event type, preferred dates and times, venue or city, estimated guest count, and requested services. Mention any setup needs or details still to be decided.",
    dateAvailability:
      "Share your preferred dates so the team can review them. An inquiry does not hold a date.",
    quotationProcess:
      "The team reviews the requirements and sends the quotation in the booking conversation. Discuss scope or price changes in the same thread.",
    bookingConfirmation:
      "A submitted or accepted request, a sent quotation, and a scheduled event day do not confirm a booking or reserve a date.",
    existingEventContact:
      "Open the request's conversation in Messages to ask about an existing event.",
    humanContact: "Ask for a team member in Messages.",
  },
  policies: {
    requirementChanges:
      "Share changes to the date, venue, guest count, or services in the booking conversation so the team can review them.",
    venueAndSetupRequirements:
      "Include any known venue access times, loading rules, and setup or teardown restrictions in the inquiry.",
  },
  faqs: [
    {
      question: "Can I inquire without choosing a package?",
      answer:
        "Yes. Describe your event in Messages or submit a request without a package. The team can discuss the details and prepare a custom package.",
    },
    {
      question: "Where will I find my quotation?",
      answer:
        "Open the conversation linked to your booking request in Messages. The team shares the quotation there.",
    },
    {
      question: "Does submitting a request reserve my date?",
      answer:
        "No. A request starts a discussion about your event, requirements, and preferred dates.",
    },
    {
      question: "What if I haven't chosen a venue yet?",
      answer:
        "Start with the city you have in mind and tell us which details are still open. Share the venue and any access restrictions in Messages once you have them.",
    },
  ],
});

export async function seedBusinessInformation(db: SeedDb) {
  const row = await db
    .insertInto("business_information")
    .values({ id: 1, information: demoBusinessInformation })
    .onConflict((conflict) =>
      conflict
        .column("id")
        .doUpdateSet((eb) => ({
          information: eb.ref("excluded.information"),
          updated_at: sql<Date>`greatest(clock_timestamp(), business_information.updated_at + interval '1 millisecond')`,
        }))
        // Only the migration placeholder is eligible. Admin saves persist a full document.
        .where("business_information.information", "=", sql<Json>`'{}'::jsonb`),
    )
    .returning("id")
    .executeTakeFirst();

  return row !== undefined;
}
