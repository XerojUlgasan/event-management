export const MAX_EVENT_TYPE_LENGTH = 200;
export const MAX_TIME_ZONE_LENGTH = 100;
export const MAX_CONTACT_NAME_LENGTH = 200;
export const MAX_PHONE_NUMBER_LENGTH = 100;
export const MAX_PREFERRED_VENUE_LOCATION_LENGTH = 1000;
export const MAX_SPECIAL_REQUESTS_LENGTH = 4000;
export const MAX_BOOKING_REASON_LENGTH = 1000;
export const MAX_BOOKING_ADDON_HOURS = 2147483647;

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
