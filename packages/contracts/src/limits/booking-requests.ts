export const MAX_EVENT_TYPE_LENGTH = 200;
export const MAX_TIME_ZONE_LENGTH = 100;
export const MAX_CONTACT_NAME_LENGTH = 200;
export const MAX_PHONE_NUMBER_LENGTH = 100;
export const MAX_PREFERRED_VENUE_LOCATION_LENGTH = 1000;
export const MAX_SPECIAL_REQUESTS_LENGTH = 4000;
export const MAX_BOOKING_REASON_LENGTH = 1000;
export const MAX_BOOKING_ADDON_HOURS = 2147483647;
export const MAX_BOOKING_ADDON_SERVICES = 100;

/** Minimum days in advance a booking request must be submitted. */
export const MIN_ADVANCE_BOOKING_DAYS = 3;

/** Full stored format including country code: +63 followed by 10 digits starting with 9. */
export const PH_PHONE_REGEX = /^\+639\d{9}$/;

/** Same rule as DISPLAY_NAME_REGEX — reused for contact person names. */
export const CONTACT_NAME_REGEX = /^[\p{L}\p{M}'\- ]+$/u;

export const BOOKING_ESTIMATED_DURATIONS = [
  "4_hours",
  "8_hours",
  "12_hours",
  "1_day",
  "2_days",
  "3_days",
  "4_days",
  "5_days",
  "6_days",
  "1_week",
  "more_than_1_week",
  "undecided",
] as const;

export type BookingEstimatedDuration =
  (typeof BOOKING_ESTIMATED_DURATIONS)[number];
