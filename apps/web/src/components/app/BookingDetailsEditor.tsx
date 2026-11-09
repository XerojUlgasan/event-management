import { MAX_BOOKING_NOTES_LENGTH, MAX_EVENT_TYPE_LENGTH, type BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests";
import { useState } from "react";
import { ApiError, getAdminBookingRequest, updateBookingDetails, type BookingRequest } from "../../lib/api";
import { useVenueOptions } from "../../lib/venues";

// Manila is UTC+08:00 for the event dates supported by this application.
const localInputValue = (value: string | null) => {
  if (!value) return "";
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? "" : new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, -1);
};

const fieldsFromItem = (item: BookingRequest) => ({
  eventType: item.eventType,
  preferredDate: item.preferredDate ?? "",
  estimatedDuration: item.estimatedDuration ?? "undecided" as BookingEstimatedDuration,
  estimatedDurationDays: String(item.estimatedDurationDays ?? ""),
  startsAt: localInputValue(item.startsAt),
  endsAt: localInputValue(item.endsAt),
  guestCount: String(item.guestCount ?? ""),
  venue: item.preferredVenueLocation ?? "",
  notes: item.notes ?? "",
});

const manilaInstant = (value: string) => new Date(`${value}+08:00`);

export function BookingDetailsEditor({ item, onSaved }: {
  item: BookingRequest;
  onSaved: (item: BookingRequest) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(item.updatedAt);
  const [fields, setFields] = useState(() => fieldsFromItem(item));
  const {
    options: venueOptions,
    loading: venuesLoading,
    error: venuesError,
  } = useVenueOptions(true);
  const venueValue = fields.venue.trim();
  const venueInOptions = venueOptions.some(
    (option) => option.value === venueValue,
  );
  const venuePlaceholder = venuesLoading
    ? "Loading venues…"
    : venuesError
      ? "Unable to load venues"
      : venueOptions.length
        ? "No preference / To be confirmed"
        : "No venues available yet";
  const startEditing = (latest: BookingRequest) => {
    setFields(fieldsFromItem(latest));
    setExpectedUpdatedAt(latest.updatedAt);
    setError("");
    setConflict(false);
    setOpen(true);
  };
  const reload = async () => {
    setBusy(true);
    try {
      const result = await getAdminBookingRequest(item.id);
      onSaved(result.bookingRequest);
      startEditing(result.bookingRequest);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reload event details.");
    } finally {
      setBusy(false);
    }
  };
  const change = (key: keyof typeof fields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!fields.eventType.trim()) return setError("Enter an event type.");
    if (!fields.preferredDate) return setError("Choose a preferred date.");
    if (
      fields.estimatedDuration === "more_than_1_week" &&
      (!Number.isInteger(Number(fields.estimatedDurationDays)) ||
        Number(fields.estimatedDurationDays) < 8)
    )
      return setError("Enter the event length in days (8 or more).");
    if (
      fields.guestCount.trim() &&
      (!Number.isInteger(Number(fields.guestCount)) ||
        Number(fields.guestCount) < 1)
    )
      return setError("Guest count must be a positive whole number.");
    if (
      fields.startsAt &&
      fields.endsAt &&
      manilaInstant(fields.endsAt) <= manilaInstant(fields.startsAt)
    )
      return setError("End time must be after the start time.");
    setBusy(true);
    setError("");
    try {
      const result = await updateBookingDetails(item.id, {
        expectedUpdatedAt,
        eventType: fields.eventType.trim(),
        preferredDate: fields.preferredDate,
        estimatedDuration: fields.estimatedDuration,
        estimatedDurationDays:
          fields.estimatedDuration === "more_than_1_week"
            ? Number(fields.estimatedDurationDays)
            : null,
        startsAt: fields.startsAt
          ? manilaInstant(fields.startsAt).toISOString()
          : null,
        endsAt: fields.endsAt ? manilaInstant(fields.endsAt).toISOString() : null,
        guestCount: fields.guestCount.trim() ? Number(fields.guestCount) : null,
        preferredVenueLocation: fields.venue.trim() || null,
        notes: fields.notes.trim() || null,
      });
      onSaved(result.bookingRequest);
      setOpen(false);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setConflict(true);
        setError(`${cause.message}. Reload the latest details before continuing.`);
      } else {
        setError(cause instanceof Error ? cause.message : "Unable to save the event details.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <div className="booking-details-editor-actions">
        <button type="button" onClick={() => startEditing(item)}>
          Edit event details
        </button>
      </div>
    );

  return (
    <div className="booking-details-editor-form">
      <h3>Edit event details</h3>
      <label>
        Event type
        <input
          value={fields.eventType}
          maxLength={MAX_EVENT_TYPE_LENGTH}
          onChange={(event) => change("eventType", event.target.value)}
        />
      </label>
      <label>
        Preferred date
        <input
          type="date"
          value={fields.preferredDate}
          onChange={(event) => change("preferredDate", event.target.value)}
        />
      </label>
      <label>
        Estimated length
        <select
          value={fields.estimatedDuration}
          onChange={(event) =>
            change("estimatedDuration", event.target.value)
          }
        >
          {Object.entries({
            "4_hours": "About 4 hours",
            "8_hours": "About 8 hours",
            "12_hours": "About 12 hours",
            "1_day": "1 day",
            "2_days": "2 days",
            "3_days": "3 days",
            "4_days": "4 days",
            "5_days": "5 days",
            "6_days": "6 days",
            "1_week": "1 week",
            more_than_1_week: "More than 1 week",
            undecided: "Not sure yet",
          }).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {fields.estimatedDuration === "more_than_1_week" && (
        <label>
          Event length in days
          <input
            type="number"
            min="8"
            step="1"
            value={fields.estimatedDurationDays}
            onChange={(event) =>
              change("estimatedDurationDays", event.target.value)
            }
          />
        </label>
      )}
      <label>
        Start time (optional)
        <input
          type="datetime-local"
          step="0.001"
          value={fields.startsAt}
          onChange={(event) => change("startsAt", event.target.value)}
        />
      </label>
      <label>
        End time (optional)
        <input
          type="datetime-local"
          step="0.001"
          value={fields.endsAt}
          onChange={(event) => change("endsAt", event.target.value)}
        />
      </label>
      <label>
        Guest count (optional)
        <input
          type="number"
          min="1"
          step="1"
          placeholder="Not sure yet"
          value={fields.guestCount}
          onChange={(event) => change("guestCount", event.target.value)}
        />
      </label>
      <label>
        Preferred venue (optional)
        <select
          value={fields.venue}
          disabled={venuesLoading || (!venueOptions.length && !venueValue)}
          onChange={(event) => change("venue", event.target.value)}
        >
          <option value="">{venuePlaceholder}</option>
          {venueValue && !venueInOptions && (
            <option value={venueValue}>{venueValue} (current)</option>
          )}
          {venueOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Internal notes (optional)
        <textarea
          value={fields.notes}
          maxLength={MAX_BOOKING_NOTES_LENGTH}
          onChange={(event) => change("notes", event.target.value)}
        />
      </label>
      <p className="booking-form-hint">
        Times use Philippine time (Asia/Manila).
      </p>
      {error && <p role="alert">{error}</p>}
      {conflict && <button type="button" disabled={busy} onClick={() => void reload()}>Reload latest details (discard edits)</button>}
      <div className="booking-actions">
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="button" disabled={busy || conflict} onClick={() => void save()}>
          {busy ? "Saving…" : "Save details"}
        </button>
      </div>
    </div>
  );
}
