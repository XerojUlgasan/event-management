export const EVENT_STATUSES = ["tentative", "confirmed", "cancelled", "rescheduled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const ASSIGNMENT_RESPONSES = ["available", "unavailable"] as const;
export type AssignmentResponse = (typeof ASSIGNMENT_RESPONSES)[number];

export const MAX_STAFF_DESCRIPTION_LENGTH = 1000;
