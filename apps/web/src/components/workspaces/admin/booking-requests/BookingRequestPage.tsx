import { BookingOfferAddons } from "../../../booking-requests/BookingOfferAddons";
import { AdminBookingStatusHistory } from "./AdminBookingStatusHistory";
import { BookingStatusEditor } from "./BookingStatusEditor";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Icon,
  PageHeader,
  Tabs,
  useNotifications,
} from "@event-management/ui";
import {
  finishEvent,
  getAdminBookingRequest,
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
  BookingStatusBadge,
  EventCompletionBadge,
} from "../../../booking-requests/BookingRequestDisplay";
import { BookingPackage } from "../../../booking-requests/BookingPackage";
import { Quotations } from "../../../quotations/Quotations";
import { AdminEventDays } from "../event-days/AdminEventDays";

function latestBooking(
  current: BookingRequest | null,
  incoming: BookingRequest,
) {
  if (current?.id !== incoming.id) return incoming;

  const latest = current.updatedAt > incoming.updatedAt ? current : incoming;
  const completion =
    current.eventCompletion?.status === "finished"
      ? current.eventCompletion
      : incoming.eventCompletion;

  return completion?.status === "finished" &&
    latest.eventCompletion !== completion
    ? { ...latest, eventCompletion: completion }
    : latest;
}

function BookingQuotations({
  bookingId,
  status,
  onBookingChanged,
}: {
  bookingId: string;
  status: BookingStatus;
  onBookingChanged: (booking: BookingRequest) => void;
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
      onBookingChanged={onBookingChanged}
      proposalAvailable={state === "ready"}
    />
  );
}

export function BookingRequestPage({
  bookingRequestId,
}: {
  bookingRequestId: string;
}) {
  const { notify, notifyError } = useNotifications();
  const [item, setItem] = useState<BookingRequest | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [editStatus, setEditStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingDay, setSavingDay] = useState(false);
  const [savingAddons, setSavingAddons] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [proposalRevision, setProposalRevision] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const changeStatusButton = useRef<HTMLButtonElement>(null);
  const historySummary = useRef<HTMLElement>(null);
  const [pageTab, setPageTab] = useState("details");
  const detailsPanelId = "booking-request-details-panel";
  const packagePanelId = "booking-request-package-panel";
  const quotationPanelId = "booking-request-quotation-panel";
  const generation = useRequestGeneration();
  const canChangeStatus =
    pageTab === "details" &&
    item &&
    item.eventCompletion?.status !== "finished" &&
    item.status !== "declined" &&
    item.status !== "cancelled";

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

      const next = result.bookingRequest;
      setItem((current) => latestBooking(current, next));
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

  const markFinished = async (booking: BookingRequest) => {
    const current = generation.bump();
    setFinishing(true);

    try {
      const { bookingRequest } = await finishEvent(
        booking.id,
        booking.updatedAt,
      );

      if (generation.isCurrent(current)) {
        setItem((item) => latestBooking(item, bookingRequest));
        notify("Event marked as finished.");
      }
    } catch (cause) {
      if (!generation.isCurrent(current)) return;

      notifyError(cause, "Unable to finish the event.");

      if (cause instanceof ApiError && cause.status === 409)
        refreshWithNotice("Unable to refresh this booking request.");
    } finally {
      setFinishing(false);
    }
  };

  useEffect(() => {
    setItem(null);
    setHistoryOpen(false);
    setEditStatus(false);
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
          disabled={refreshing || savingStatus || savingDay || finishing}
          onClick={() => {
            setEditStatus(false);
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
              title={`${item.eventType} booking request`}
              description={item.packageName ?? "No catalog package selected"}
            />
            <div className="booking-request-status-row">
              <BookingStatusBadge status={item.status} />
              {item.eventCompletion && (
                <EventCompletionBadge status={item.eventCompletion.status} />
              )}
              {pageTab === "details" &&
                item.eventCompletion?.status === "ready" &&
                !editStatus && (
                  <Button
                    size="small"
                    pending={finishing}
                    disabled={
                      refreshing || savingStatus || savingDay || savingAddons
                    }
                    onClick={() => void markFinished(item)}
                  >
                    Mark as finished
                  </Button>
                )}
              {canChangeStatus && !editStatus && (
                <Button
                  ref={changeStatusButton}
                  variant="secondary"
                  size="small"
                  disabled={
                    savingStatus || refreshing || savingDay || finishing
                  }
                  onClick={() => setEditStatus(true)}
                >
                  Change status
                </Button>
              )}
            </div>
            {pageTab === "details" && (
              <>
                {editStatus && canChangeStatus && (
                  <div inert={refreshing || savingDay || undefined}>
                    <BookingStatusEditor
                      key={`${item.id}:${item.status}`}
                      item={item}
                      onClose={() => {
                        setEditStatus(false);
                        requestAnimationFrame(() =>
                          changeStatusButton.current?.focus(),
                        );
                      }}
                      onBusyChange={setSavingStatus}
                      onSaved={(updated) => {
                        generation.bump();
                        setItem(updated);
                        setEditStatus(false);
                        setHistoryOpen(true);
                        historySummary.current?.focus();
                      }}
                    />
                  </div>
                )}
                <details
                  className="booking-request-history"
                  open={historyOpen}
                  onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
                >
                  <summary ref={historySummary}>Status history</summary>
                  {historyOpen && (
                    <AdminBookingStatusHistory
                      id={item.id}
                      revision={item.updatedAt}
                      timeZone={item.timeZone}
                    />
                  )}
                </details>
              </>
            )}
          </div>
          <Tabs
            role="tablist"
            variant="underline"
            className="booking-request-tabs"
            active={pageTab}
            onChange={(tab) => {
              if (tab === pageTab) return;

              setEditStatus(false);
              setPageTab(tab);
            }}
            aria-label="Booking sections"
            items={[
              {
                value: "details",
                label: "Details",
                id: "booking-tab-details",
                panelId: detailsPanelId,
                disabled:
                  (savingDay || savingStatus || finishing) &&
                  pageTab !== "details",
              },
              {
                value: "package",
                label: "Package",
                id: "booking-tab-package",
                panelId: packagePanelId,
                disabled:
                  (savingDay || savingStatus || finishing) &&
                  pageTab !== "package",
              },
              {
                value: "quotation",
                label: "Quotation",
                id: "booking-tab-quotation",
                panelId: quotationPanelId,
                disabled:
                  (savingDay || savingStatus || finishing) &&
                  pageTab !== "quotation",
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
                <h2 id="request-overview-title">Request details</h2>
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
                    {item.budget && (
                      <div>
                        <dt>Budget</dt>
                        <dd>{item.budget}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Requested</dt>
                      <dd>
                        {bookingDateTime(item.submittedAt, item.timeZone)}
                      </dd>
                    </div>
                  </dl>
                </div>
                <BookingOfferAddons
                  booking={item}
                  disabled={
                    refreshing || savingStatus || savingDay || finishing
                  }
                  onBusyChange={setSavingAddons}
                  onChanged={(updated) =>
                    setItem((current) =>
                      current?.id === updated.id
                        ? latestBooking(current, updated)
                        : current,
                    )
                  }
                />
                <p className="booking-request-overview-note">
                  Dates are not reserved. Processing does not confirm the
                  booking.
                </p>
              </section>
              <div
                inert={savingStatus || refreshing || finishing || undefined}
                aria-busy={savingStatus || refreshing || finishing}
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
                onBookingChanged={(booking) => {
                  setItem((current) =>
                    current?.id === booking.id &&
                    current.updatedAt < booking.updatedAt
                      ? latestBooking(current, booking)
                      : current,
                  );
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
