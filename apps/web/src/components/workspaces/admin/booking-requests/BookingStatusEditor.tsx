import { useRef, useState, type SubmitEvent } from "react";
import {
  Button,
  FormField,
  Select,
  Textarea,
  useNotifications,
} from "@event-management/ui";
import { bookingStatusSchema } from "@event-management/contracts/booking-requests";
import { MAX_BOOKING_REASON_LENGTH } from "@event-management/contracts/limits/booking-requests";
import {
  updateBookingRequestStatus,
  type BookingRequest,
  type BookingStatus,
} from "../../../../lib/data/booking-requests/requests";
import { ApiError } from "../../../../lib/http/request";
import { bookingStatusLabels } from "../../../booking-requests/BookingRequestDisplay";

export function BookingStatusEditor({
  item,
  onSaved,
  onClose,
  onBusyChange,
}: {
  item: BookingRequest;
  onSaved: (item: BookingRequest) => void;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { notify, notifyError } = useNotifications();
  const [status, setStatus] = useState<BookingStatus | "">("");

  const choices = bookingStatusSchema.options.filter(
    (value) =>
      value !== "under_review" && value !== "finished" && value !== item.status,
  );

  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const savingRef = useRef(false);
  const reasonRequired =
    status === "needs_details" ||
    status === "declined" ||
    status === "cancelled";

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      savingRef.current ||
      stale ||
      !status ||
      (reasonRequired && !reason.trim())
    )
      return;

    savingRef.current = true;
    setSaving(true);
    onBusyChange(true);
    setError("");

    try {
      const result = await updateBookingRequestStatus(
        item.id,
        status,
        reason.trim() || undefined,
      );
      notify(
        `Request status updated to ${bookingStatusLabels[result.bookingRequest.status].toLowerCase()}.`,
      );
      onSaved(result.bookingRequest);
    } catch (cause) {
      setStale(cause instanceof ApiError && cause.status === 409);
      setError(notifyError(cause, "Unable to update request status."));
    } finally {
      savingRef.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      className="booking-request-status-form"
      onSubmit={save}
      aria-label="Change booking request status"
    >
      <fieldset disabled={saving || stale}>
        <FormField label="New status">
          {(props) => (
            <Select
              {...props}
              autoFocus
              required
              value={status}
              onChange={(event) =>
                setStatus(
                  choices.find((choice) => choice === event.target.value) ?? "",
                )
              }
            >
              <option value="" disabled>
                Choose a new status
              </option>
              {choices.map((choice) => (
                <option key={choice} value={choice}>
                  {bookingStatusLabels[choice]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        {status && (
          <FormField
            label={`Reason (${reasonRequired ? "required" : "optional"})`}
            description="Visible to the customer in status history."
          >
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                value={reason}
                maxLength={MAX_BOOKING_REASON_LENGTH}
                required={reasonRequired}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </FormField>
        )}
      </fieldset>
      {status === "cancelled" && (
        <p className="booking-status-impact">
          Cancelling closes this request and cancels its scheduled event days.
        </p>
      )}
      {status === "declined" && (
        <p className="booking-status-impact">Declining closes this request.</p>
      )}
      {error && (
        <p role="alert" className="booking-request-error">
          {error}
          {stale && " Refresh the request before trying again."}
        </p>
      )}
      <div className="booking-request-actions">
        <Button
          type="submit"
          variant={
            status === "declined" || status === "cancelled"
              ? "danger"
              : "primary"
          }
          pending={saving}
          disabled={stale || !status || (reasonRequired && !reason.trim())}
        >
          {saving
            ? "Saving…"
            : status === "cancelled"
              ? "Cancel request"
              : status === "declined"
                ? "Decline request"
                : "Save status"}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
