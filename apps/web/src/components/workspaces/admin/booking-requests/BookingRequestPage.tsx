import { BookingStatusHistory } from "../../../booking-requests/BookingStatusHistory";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import {
  Button,
  FormField,
  Icon,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  useNotifications,
} from "@event-management/ui";
import { MAX_BOOKING_REASON_LENGTH } from "@event-management/contracts/limits/booking-requests";
import {
  getAdminBookingRequest,
  updateBookingRequestStatus,
  type BookingRequest,
  type BookingStatus,
} from "../../../../lib/data/booking-requests/requests";
import { getBookingPackage } from "../../../../lib/data/booking-requests/packages";
import { ApiError } from "../../../../lib/http/request";
import { durationLabel } from "../../../../lib/utils/booking-requests/duration";
import { useRequestGeneration } from "../../../../lib/pagination/use-request-generation";
import { formatPesosFromMinor } from "../../../../lib/utils/formatting/money";
import {
  bookingDate,
  bookingDateTime,
  bookingStatusLabels,
  BookingStatusBadge,
} from "../../../booking-requests/BookingRequestDisplay";
import { BookingPackage } from "../../../booking-requests/BookingPackage";
import { Quotations } from "../../../quotations/Quotations";
import { AdminEventDays } from "../event-days/AdminEventDays";

function RequestStatusForm({
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
  const [status, setStatus] = useState(item.status);
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
      status === item.status ||
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
      aria-labelledby="request-status-title"
    >
      <h3 id="request-status-title">Update request status</h3>
      <fieldset disabled={saving || stale}>
        <FormField label="Status">
          {(props) => (
            <Select
              {...props}
              value={status}
              onChange={(event) => {
                const value = event.target.value;

                if (
                  value === "under_review" ||
                  value === "needs_details" ||
                  value === "accepted" ||
                  value === "declined" ||
                  value === "cancelled"
                )
                  setStatus(value);
              }}
            >
              {Object.entries(bookingStatusLabels).map(([value, label]) => (
                <option
                  key={value}
                  value={value}
                  disabled={
                    value === "under_review" && item.status !== "under_review"
                  }
                >
                  {label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label={`Reason (${reasonRequired ? "required" : "optional"})`}
        >
          {(props) => (
            <Textarea
              {...props}
              value={reason}
              maxLength={MAX_BOOKING_REASON_LENGTH}
              required={reasonRequired}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </FormField>
      </fieldset>
      {error && (
        <p role="alert" className="booking-request-error">
          {error}
          {stale && " Refresh the request before trying again."}
        </p>
      )}
      <div className="booking-request-actions">
        <Button
          type="submit"
          pending={saving}
          disabled={
            stale ||
            status === item.status ||
            (reasonRequired && !reason.trim())
          }
        >
          {saving ? "Saving…" : "Update status"}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          Close
        </Button>
      </div>
    </form>
  );
}

function BookingQuotations({
  bookingId,
  status,
  refreshBooking,
}: {
  bookingId: string;
  status: BookingStatus;
  refreshBooking: () => Promise<void>;
}) {
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState("loading");
    void getBookingPackage(bookingId, true)
      .then((result) => {
        if (active) setState(result.package ? "ready" : "missing");
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => {
      active = false;
    };
  }, [bookingId, attempt]);

  if (state === "loading") return <p role="status">Checking package…</p>;

  if (state === "error")
    return (
      <p role="alert">
        Unable to load the current package.{" "}
        <Button
          variant="secondary"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Retry
        </Button>
      </p>
    );

  return (
    <Quotations
      bookingId={bookingId}
      admin
      bookingStatus={status}
      refreshBooking={refreshBooking}
      proposalAvailable={state === "ready"}
    />
  );
}

export function BookingRequestPage({
  bookingRequestId,
}: {
  bookingRequestId: string;
}) {
  const { notifyError } = useNotifications();
  const [item, setItem] = useState<BookingRequest | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [editStatus, setEditStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingDay, setSavingDay] = useState(false);
  const [proposalRevision, setProposalRevision] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [pageTab, setPageTab] = useState("details");
  const detailsPanelId = "booking-request-details-panel";
  const packagePanelId = "booking-request-package-panel";
  const quotationPanelId = "booking-request-quotation-panel";
  const generation = useRequestGeneration();

  const refresh = useCallback(async () => {
    const current = generation.bump();
    setRefreshing(true);
    setError("");
    setNeedsSignIn(false);

    try {
      const result = await getAdminBookingRequest(bookingRequestId);

      if (!generation.isCurrent(current))
        throw new Error(
          "The request changed while refreshing. Please try again.",
        );

      setItem(result.bookingRequest);
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      if (generation.isCurrent(current)) {
        setNeedsSignIn(cause instanceof ApiError && cause.status === 401);
        setError(
          cause instanceof ApiError && cause.status === 404
            ? "This booking request was not found."
            : cause instanceof Error
              ? cause.message
              : "Unable to load this booking request.",
        );
      }

      throw cause;
    } finally {
      if (generation.isCurrent(current)) setRefreshing(false);
    }
  }, [bookingRequestId, generation]);

  const refreshWithNotice = (fallback: string) => {
    const pending = refresh();
    const current = generation.current();
    void pending.catch((cause) => {
      if (generation.isCurrent(current)) notifyError(cause, fallback);
    });
  };

  useEffect(() => {
    setItem(null);
    setNotice("");
    setPageTab("details");
    const pending = refresh();
    const current = generation.current();
    void pending.catch((cause) => {
      if (generation.isCurrent(current))
        notifyError(cause, "Unable to load this booking request.");
    });

    return () => {
      generation.bump();
    };
  }, [refresh, notifyError, generation]);

  return (
    <div className="booking-request-page">
      <nav className="booking-request-nav" aria-label="Booking navigation">
        <a href="/app/bookings" className="booking-request-back">
          <Icon name="chevron" size={15} />
          Back to booking requests
        </a>
        <Button
          variant="link"
          disabled={refreshing || savingStatus || savingDay}
          onClick={() => {
            setNotice("");
            refreshWithNotice("Unable to refresh this booking request.");
          }}
        >
          {refreshing && item ? "Refreshing…" : "Refresh request and days"}
        </Button>
      </nav>
      {!item && !error && <p role="status">Loading booking request…</p>}
      {error && (
        <section className="booking-request-load-error">
          <h1 className="page-title">Booking request</h1>
          <p role="alert">{error}</p>
          {needsSignIn && (
            <a
              className="booking-request-back"
              href={`/login?next=${encodeURIComponent(window.location.pathname)}`}
            >
              Sign in again
            </a>
          )}
          <Button
            variant="secondary"
            disabled={refreshing}
            onClick={() =>
              refreshWithNotice("Unable to refresh this booking request.")
            }
          >
            {refreshing ? "Refreshing…" : "Try again"}
          </Button>
        </section>
      )}
      {item && !error && (
        <>
          <div className="booking-request-heading">
            <PageHeader
              title={`Booking request ${item.reference}`}
              description={`${item.eventType} · ${item.packageName ?? "No catalog package selected"}`}
            />
            <BookingStatusBadge status={item.status} />
          </div>
          {notice && (
            <p className="booking-request-success" role="status">
              {notice}
            </p>
          )}
          <Tabs
            role="tablist"
            variant="underline"
            className="booking-request-tabs"
            active={pageTab}
            onChange={setPageTab}
            aria-label="Booking sections"
            items={[
              {
                value: "details",
                label: "Details",
                id: "booking-tab-details",
                panelId: detailsPanelId,
                disabled: (savingDay || savingStatus) && pageTab !== "details",
              },
              {
                value: "package",
                label: "Package",
                id: "booking-tab-package",
                panelId: packagePanelId,
                disabled: (savingDay || savingStatus) && pageTab !== "package",
              },
              {
                value: "quotation",
                label: "Quotation",
                id: "booking-tab-quotation",
                panelId: quotationPanelId,
                disabled:
                  (savingDay || savingStatus) && pageTab !== "quotation",
              },
            ]}
          />
          {pageTab === "details" && (
            <div
              id={detailsPanelId}
              role="tabpanel"
              tabIndex={0}
              aria-labelledby="booking-tab-details"
            >
              <section
                className="booking-request-overview"
                aria-labelledby="request-overview-title"
                aria-busy={savingStatus || refreshing}
              >
                <div className="booking-request-overview-heading">
                  <h2 id="request-overview-title">Request details</h2>
                  {!["declined", "cancelled"].includes(item.status) && (
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={savingStatus || refreshing || savingDay}
                      aria-expanded={editStatus}
                      aria-controls="booking-status-editor"
                      onClick={() => setEditStatus((value) => !value)}
                    >
                      Update status
                    </Button>
                  )}
                </div>
                <div className="booking-request-info">
                  <dl>
                    <div>
                      <dt>Event type</dt>
                      <dd>{item.eventType}</dd>
                    </div>
                    <div>
                      <dt>Catalog package</dt>
                      <dd>
                        {item.packageName && item.packagePrice ? (
                          <>
                            {item.packageName} ·{" "}
                            {formatPesosFromMinor(
                              item.packagePrice.amountMinor,
                            )}{" "}
                            · up to {item.packageMaxGuests} guests
                          </>
                        ) : (
                          "No catalog package selected · Amount to be discussed"
                        )}
                      </dd>
                    </div>
                    {item.requestedDays ? (
                      <div>
                        <dt>Requested dates</dt>
                        <dd>
                          {item.requestedDays.length}{" "}
                          {item.requestedDays.length === 1 ? "day" : "days"} ·{" "}
                          {item.requestedDays
                            .map((day) => bookingDate(day.date))
                            .join("; ")}
                        </dd>
                      </div>
                    ) : (
                      <>
                        <div>
                          <dt>Preferred date</dt>
                          <dd>{bookingDate(item.preferredDate)}</dd>
                        </div>
                        <div>
                          <dt>Estimated length</dt>
                          <dd>
                            {durationLabel(
                              item.estimatedDuration,
                              item.estimatedDurationDays,
                            )}
                          </dd>
                        </div>
                      </>
                    )}
                    {item.startsAt && (
                      <div>
                        <dt>Start time</dt>
                        <dd>{bookingDateTime(item.startsAt, item.timeZone)}</dd>
                      </div>
                    )}
                    {item.endsAt && (
                      <div>
                        <dt>End time</dt>
                        <dd>{bookingDateTime(item.endsAt, item.timeZone)}</dd>
                      </div>
                    )}
                    {item.preferredVenueLocation && (
                      <div>
                        <dt>Preferred venue</dt>
                        <dd>{item.preferredVenueLocation}</dd>
                      </div>
                    )}
                  </dl>
                  <dl>
                    <div>
                      <dt>Contact person</dt>
                      <dd>{item.contactName}</dd>
                    </div>
                    <div>
                      <dt>Phone number</dt>
                      <dd>{item.phoneNumber}</dd>
                    </div>
                    <div>
                      <dt>Special requests</dt>
                      <dd>{item.specialRequests || "None"}</dd>
                    </div>
                    <div>
                      <dt>Requested</dt>
                      <dd>{bookingDateTime(item.createdAt, item.timeZone)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="booking-request-overview-footer">
                  <p>
                    Dates are not reserved. Processing does not confirm the
                    booking.
                  </p>
                  <BookingStatusHistory
                    id={item.id}
                    admin
                    revision={item.updatedAt}
                    timeZone={item.timeZone}
                    className="booking-request-history"
                  />
                </div>
                {editStatus && (
                  <div
                    id="booking-status-editor"
                    inert={refreshing || savingDay || undefined}
                  >
                    <RequestStatusForm
                      key={`${item.id}:${item.status}`}
                      item={item}
                      onClose={() => setEditStatus(false)}
                      onBusyChange={setSavingStatus}
                      onSaved={(updated) => {
                        generation.bump();
                        setItem(updated);
                        setEditStatus(false);
                        setNotice(
                          `Request status updated to ${bookingStatusLabels[updated.status].toLowerCase()}.`,
                        );
                      }}
                    />
                  </div>
                )}
              </section>
              <div
                inert={savingStatus || refreshing || undefined}
                aria-busy={savingStatus || refreshing}
              >
                <AdminEventDays
                  key={item.id}
                  booking={item}
                  onBookingChanged={refresh}
                  refreshKey={refreshKey}
                  onBusyChange={setSavingDay}
                />
              </div>
            </div>
          )}
          {pageTab === "package" && (
            <div
              id={packagePanelId}
              role="tabpanel"
              tabIndex={0}
              aria-labelledby="booking-tab-package"
            >
              <BookingPackage
                id={item.id}
                admin
                refreshBooking={refresh}
                editable={!["declined", "cancelled"].includes(item.status)}
                onChanged={() => {
                  setProposalRevision((value) => value + 1);
                  refreshWithNotice("Unable to refresh the booking.");
                }}
              />
            </div>
          )}
          {pageTab === "quotation" && (
            <div
              id={quotationPanelId}
              role="tabpanel"
              tabIndex={0}
              aria-labelledby="booking-tab-quotation"
            >
              <BookingQuotations
                key={`${item.id}:${proposalRevision}`}
                bookingId={item.id}
                status={item.status}
                refreshBooking={refresh}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
