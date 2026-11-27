import type { PublicService } from "../../data/catalog/services";

export type BookingAddon = {
  service: PublicService;
  hours: string;
  needsReview?: boolean;
  refreshed?: boolean;
};

import type { PublicPackage } from "../../data/catalog/packages";

const KEY = "amac-booking-draft";
const LEGACY_KEY = "clemora-booking-draft";

export type BookingDraftFields = {
  eventType: string;
  customEventType: string;
  durationMode: "one_day" | "multi_day";
  dates: string[];
  contactName: string;
  phoneNumber: string;
  specialRequests: string;
};

export type BookingDraft = {
  item: PublicPackage;
  fields: BookingDraftFields;
  timeZone: string;
  addons?: BookingAddon[];
};

export function readBookingDraft(): BookingDraft | null {
  try {
    const current = sessionStorage.getItem(KEY);
    const legacy = current === null ? sessionStorage.getItem(LEGACY_KEY) : null;
    const draft = JSON.parse(current ?? legacy ?? "null");

    if (legacy !== null) {
      try {
        sessionStorage.setItem(KEY, legacy);
        sessionStorage.removeItem(LEGACY_KEY);
      } catch {
        // Continue using the old draft if storage cannot be updated.
      }
    }

    return draft &&
      typeof draft.item?.id === "string" &&
      typeof draft.item?.updatedAt === "string" &&
      Number.isInteger(draft.item?.maxGuests) &&
      draft.fields &&
      typeof draft.fields === "object"
      ? (draft as BookingDraft)
      : null;
  } catch {
    return null;
  }
}

export function clearBookingDraft() {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(LEGACY_KEY);
}

export function saveBookingDraft(draft: BookingDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
  sessionStorage.removeItem(LEGACY_KEY);
}
