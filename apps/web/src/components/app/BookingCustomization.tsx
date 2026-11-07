import {
  MAX_ARRANGEMENT_NOTES_LENGTH,
  MAX_BOOKING_REASON_LENGTH,
  MAX_CUSTOMIZATION_REQUEST_DESCRIPTION_LENGTH,
  MAX_EVENT_TYPE_LENGTH,
  MAX_PREFERRED_VENUE_LOCATION_LENGTH,
  CUSTOMIZATION_REQUEST_TYPES,
  type BookingEstimatedDuration,
  type CustomizationRequestStatus,
  type CustomizationRequestType,
} from "@event-management/contracts/limits/booking-requests";
import { useEffect, useState } from "react";
import { Badge } from "@event-management/ui";
import {
  createCustomizationRequest,
  createCustomerCustomizationRequest,
  decideCustomizationRequest,
  getAdminBookingRequest,
  getAdminCustomizationRequests,
  withdrawCustomizationRequest,
  updateBookingArrangement,
  type AdminCustomizationRequest,
  type BookingRequest,
  type CustomizationRequest,
} from "../../lib/api";

const typeLabels: Record<CustomizationRequestType, string> = {
  add_inclusions: "Add inclusions or items",
  remove_inclusions: "Remove package inclusions",
  substitute_inclusions: "Substitute inclusions",
  modify_inclusions: "Modify inclusions",
  adjust_quantities: "Adjust quantities or guest count",
  add_event_hours: "Add event hours",
  change_venue: "Change venue",
  special_requirements: "Special requirements",
};

const statusLabels: Record<CustomizationRequestStatus, string> = {
  requested: "Pending decision",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const statusTones: Record<CustomizationRequestStatus, string> = {
  requested: "warning",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

const timestamp = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "";

const localInputValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function ArrangementEditor({
  item,
  onSaved,
}: {
  item: BookingRequest;
  onSaved: (item: BookingRequest) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState(() => ({
    eventType: item.arrangement?.eventType ?? item.eventType,
    preferredDate: item.arrangement?.preferredDate ?? item.preferredDate ?? "",
    estimatedDuration: (item.arrangement?.estimatedDuration ??
      item.estimatedDuration ??
      "undecided") as BookingEstimatedDuration,
    estimatedDurationDays: String(
      item.arrangement?.estimatedDurationDays ??
        item.estimatedDurationDays ??
        "",
    ),
    startsAt: localInputValue(item.arrangement?.startsAt ?? item.startsAt),
    endsAt: localInputValue(item.arrangement?.endsAt ?? item.endsAt),
    guestCount: String(
      item.arrangement?.guestCount ?? item.guestCount ?? "",
    ),
    venue:
      item.arrangement?.preferredVenueLocation ??
      item.preferredVenueLocation ??
      "",
    notes: item.arrangement?.notes ?? "",
  }));
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
      new Date(fields.endsAt) <= new Date(fields.startsAt)
    )
      return setError("End time must be after the start time.");
    setBusy(true);
    setError("");
    try {
      const result = await updateBookingArrangement(item.id, {
        ...(item.arrangement
          ? { expectedUpdatedAt: item.arrangement.updatedAt }
          : {}),
        eventType: fields.eventType.trim(),
        preferredDate: fields.preferredDate,
        estimatedDuration: fields.estimatedDuration,
        estimatedDurationDays:
          fields.estimatedDuration === "more_than_1_week"
            ? Number(fields.estimatedDurationDays)
            : null,
        startsAt: fields.startsAt
          ? new Date(fields.startsAt).toISOString()
          : null,
        endsAt: fields.endsAt ? new Date(fields.endsAt).toISOString() : null,
        guestCount: fields.guestCount.trim() ? Number(fields.guestCount) : null,
        preferredVenueLocation: fields.venue.trim() || null,
        notes: fields.notes.trim() || null,
      });
      onSaved(result.bookingRequest);
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save the arrangement.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <div className="booking-arrangement-actions">
        <button type="button" onClick={() => setOpen(true)}>
          Edit arrangement
        </button>
      </div>
    );

  return (
    <div className="booking-arrangement-form">
      <h3>Edit arrangement</h3>
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
          value={fields.startsAt}
          onChange={(event) => change("startsAt", event.target.value)}
        />
      </label>
      <label>
        End time (optional)
        <input
          type="datetime-local"
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
        <input
          value={fields.venue}
          maxLength={MAX_PREFERRED_VENUE_LOCATION_LENGTH}
          onChange={(event) => change("venue", event.target.value)}
        />
      </label>
      <label>
        Internal notes (optional)
        <textarea
          value={fields.notes}
          maxLength={MAX_ARRANGEMENT_NOTES_LENGTH}
          onChange={(event) => change("notes", event.target.value)}
        />
      </label>
      <p className="booking-form-hint">
        Times are entered in your device time zone and stored as exact
        timestamps. The requested time zone stays {item.timeZone}.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="booking-actions">
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save arrangement"}
        </button>
      </div>
    </div>
  );
}

function DecisionForm({
  request,
  onSaved,
}: {
  request: CustomizationRequest;
  onSaved: (item: BookingRequest) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | "">("");
  const [error, setError] = useState("");

  const decide = async (decision: "approved" | "rejected") => {
    if (decision === "rejected" && !reason.trim()) {
      setError("A reason is required when rejecting a request.");
      return;
    }
    setBusy(decision);
    setError("");
    try {
      const result = await decideCustomizationRequest(
        request.id,
        decision,
        reason.trim() || undefined,
      );
      onSaved(result.bookingRequest);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to decide this request.",
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="booking-customization-decision">
      <label>
        Decision reason (required to reject)
        <textarea
          value={reason}
          maxLength={MAX_BOOKING_REASON_LENGTH}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="booking-actions">
        <button
          type="button"
          disabled={busy !== ""}
          onClick={() => void decide("rejected")}
        >
          {busy === "rejected" ? "Rejecting…" : "Reject"}
        </button>
        <button
          type="button"
          disabled={busy !== ""}
          onClick={() => void decide("approved")}
        >
          {busy === "approved" ? "Approving…" : "Approve"}
        </button>
      </div>
    </div>
  );
}

export function CustomizationRequestsPanel({
  item,
  admin,
  conversationId,
  onSaved,
}: {
  item: BookingRequest;
  admin: boolean;
  conversationId?: string;
  onSaved: (item: BookingRequest) => void;
}) {
  const [type, setType] = useState<CustomizationRequestType>("add_inclusions");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const terminal = ["declined", "cancelled"].includes(item.status);

  const record = async () => {
    if (!description.trim())
      return setError("Describe the recorded customization.");
    setBusy(true);
    setError("");
    try {
      const create = admin
        ? createCustomizationRequest
        : createCustomerCustomizationRequest;
      const result = await create(item.id, {
        type,
        description: description.trim(),
        ...(conversationId ? { conversationId } : {}),
      });
      onSaved(result.bookingRequest);
      setDescription("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to record the customization.",
      );
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await withdrawCustomizationRequest(id);
      onSaved(result.bookingRequest);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to withdraw the customization.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="booking-customization" aria-labelledby="customization-title">
      <div className="booking-customization-head">
        <div>
          <h3 id="customization-title">Customization records</h3>
          <p>
            Record the changes agreed with the customer in chat. A record does
            not change the package price or confirm a booking.
          </p>
        </div>
        {item.pendingCustomizationRequests > 0 && (
          <Badge tone="warning">
            {item.pendingCustomizationRequests} pending
          </Badge>
        )}
      </div>
      {item.customizationRequests.length === 0 ? (
        <p className="booking-customization-empty">
          No customization has been recorded yet.
        </p>
      ) : (
        <ul className="booking-customization-list">
          {item.customizationRequests.map((request) => (
            <li key={request.id} className="booking-customization-item">
              <div className="booking-customization-item-head">
                <strong>{typeLabels[request.type]}</strong>
                <Badge tone={statusTones[request.status]}>
                  {statusLabels[request.status]}
                </Badge>
              </div>
              <p>{request.description}</p>
              <small>
                {request.requestedByName} · {timestamp(request.createdAt)}
              </small>
              {request.decisionReason && (
                <small>
                  Decision: {request.decisionReason}
                  {request.decidedByName
                    ? ` — ${request.decidedByName}, ${timestamp(request.decidedAt)}`
                    : ""}
                </small>
              )}
              {admin && request.status === "requested" && (
                <DecisionForm request={request} onSaved={onSaved} />
              )}
              {!admin && request.status === "requested" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void withdraw(request.id)}
                >
                  {busy ? "Withdrawing…" : "Withdraw request"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!terminal && (
        <div className="booking-customization-form">
          <label>
            Change type
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as CustomizationRequestType)
              }
            >
              {CUSTOMIZATION_REQUEST_TYPES.map((value) => (
                <option key={value} value={value}>
                  {typeLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {admin
              ? "What was agreed in chat?"
              : "What would you like to change?"}
            <textarea
              value={description}
              maxLength={MAX_CUSTOMIZATION_REQUEST_DESCRIPTION_LENGTH}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div className="booking-actions">
            <button type="button" disabled={busy} onClick={() => void record()}>
              {busy
                ? "Saving…"
                : admin
                  ? "Record customization"
                  : "Submit customization request"}
            </button>
          </div>
        </div>
      )}
      {terminal && (
        <p className="booking-form-hint">
          This request is {item.status}. Customization records are closed.
        </p>
      )}
    </section>
  );
}

export function CustomizationQueue({
  revision,
  onOpen,
}: {
  revision: number;
  onOpen: (item: BookingRequest) => void;
}) {
  const [requests, setRequests] = useState<AdminCustomizationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAdminCustomizationRequests({ status: "requested", limit: 10 })
      .then((result) => {
        if (active) setRequests(result.requests);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load customization requests.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  return (
    <section className="booking-queue panel" aria-labelledby="booking-queue-title">
      <div className="booking-queue-head">
        <div>
          <h2 id="booking-queue-title">Customization queue</h2>
          <p>Recorded changes awaiting a decision, newest first.</p>
        </div>
        <span className="booking-queue-count" aria-label={`${requests.length} pending`}>
          {requests.length}
        </span>
      </div>
      {loading ? (
        <p role="status">Loading customization requests…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : requests.length === 0 ? (
        <p className="booking-queue-empty">No recorded customization is pending.</p>
      ) : (
        <div className="booking-queue-list">
          {requests.map((request) => (
            <div className="booking-queue-row" key={request.id}>
              <span>
                <strong>{typeLabels[request.type]}</strong>
                <small>
                  {request.customerName} · {request.bookingRequestReference} ·{" "}
                  {request.packageName}
                </small>
                <p>{request.description}</p>
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const result = await getAdminBookingRequest(
                      request.bookingRequestId,
                    );
                    onOpen(result.bookingRequest);
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Unable to open the booking request.",
                    );
                  }
                }}
              >
                Review
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
