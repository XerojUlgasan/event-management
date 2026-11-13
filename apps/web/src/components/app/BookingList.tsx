import { navigateWorkspace } from "../../lib/workspace-navigation"
import { BookingPackage } from "./BookingPackage";
import { Quotations } from "./Quotations";
import { ApiError } from "../../lib/http";
import { getMyBookingRequest } from "../../lib/data/booking-requests";
import { localInput, zonedInstant } from "../../lib/utils/event-day-time";
import { FormField, Input, NativeDialog, Select, Textarea, useNotifications } from "@event-management/ui"
import { MAX_BOOKING_REASON_LENGTH } from "@event-management/contracts/limits/booking-requests";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button, Icon, MonthCalendar, PageHeader, Panel, Tabs } from "@event-management/ui";
import { durationLabel } from "./BookingRequest";
import {
  cancelMyBookingRequest,
  updateRequestedDayTimes,
  getAdminBookingRequests,
  getAdminBookingRequestsPage,
  getBookingRequestCalendar,
  getMyBookingRequests,
  updateBookingRequestStatus,
  type BookingRequest,
  type BookingStatus,
} from "../../lib/data/booking-requests";

import { bookingStatusLabels as labels, bookingDateTime as dateLabel, bookingDate as preferredDateLabel, BookingStatusBadge } from "./booking-request-display";
import { adminBookingRequestPath } from "./routes";

export function BookingList(props: {
  admin?: boolean;
  readOnly?: boolean;
  onExplore?: () => void;
  onOpenChat?: (reference: string) => void;
}) {
  return props.admin ? (
    <AdminBookingList />
  ) : (
    <BookingCards {...props} />
  );
}
function requestedSummary(item: BookingRequest) { return item.requestedDays ? `${preferredDateLabel(item.requestedDays[0]?.date ?? null)}${item.requestedDays.length > 1 ? ` + ${item.requestedDays.length - 1} more` : ""}` : preferredDateLabel(item.preferredDate); }
function OperationalSchedule({ day }: { day: NonNullable<BookingRequest["requestedDays"]>[number] }) {
  const schedule = day.operationalSchedule;
  if (!schedule) return <span>{day.eventDayId ? "Operational schedule unavailable" : "Not scheduled"}</span>;
  const moved = schedule.id !== day.eventDayId;
  const status = schedule.status === "cancelled" ? "Cancelled" : schedule.status === "scheduled" ? "Scheduled" : schedule.status;
  return <span>{moved ? `Moved · ${status}` : status}: {preferredDateLabel(schedule.day)} · {dateLabel(schedule.startsAt, schedule.timeZone)} – {dateLabel(schedule.endsAt, schedule.timeZone)} ({schedule.timeZone})</span>;
}
function BookingCards({
  admin = false,
  readOnly = false,
  onExplore,
  onOpenChat,
}: {
  admin?: boolean;
  readOnly?: boolean;
  onExplore?: () => void;
  onOpenChat?: (reference: string) => void;
}) {
  const { notify, notifyError } = useNotifications();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [items, setItems] = useState<BookingRequest[]>([]);
  const [selected, setSelected] = useState<BookingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await (admin
        ? getAdminBookingRequests()
        : getMyBookingRequests());
      if (!mounted.current) return;
      setItems(result.bookingRequests);
    } catch (cause) {
      if (!mounted.current) return;
      setError(notifyError(cause, "Unable to load requests."));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [admin, notifyError]);
  useEffect(() => {
    void load();
  }, [load]);
  const cancel = async (id: string, reason: string) => {
    setBusy(id);
    setError("");
    try {
      const result = await cancelMyBookingRequest(id, reason.trim());
      setItems((rows) =>
        rows.map((row) => (row.id === id ? result.bookingRequest : row)),
      );
      notify("Booking request cancelled.");
    } catch (cause) {
      setError(notifyError(cause, "Unable to cancel request."));
    } finally {
      setBusy("");
    }
  };
  const update = async (id: string, status: BookingStatus, reason: string) => {
    setBusy(id);
    setError("");
    try {
      const result = await updateBookingRequestStatus(
        id,
        status,
        reason.trim() || undefined,
      );
      setItems((rows) =>
        rows.map((row) => (row.id === id ? result.bookingRequest : row)),
      );
      notify("Booking request status updated.");
    } catch (cause) {
      setError(notifyError(cause, "Unable to update request."));
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="booking-list">
      <PageHeader
        title={admin ? "Booking requests" : "My events"}
        description={
          admin
            ? "Review requests and follow up on event details."
            : "Follow your event requests and their review status."
        }
        actions={
          !admin && onExplore ? (
            <Button icon="calendar" onClick={onExplore}>
              Explore packages
            </Button>
          ) : undefined
        }
      />
      <p className="booking-list-note">
        Preferred dates and final prices are subject to staff review. Accepted
        requests are being processed and are not confirmed bookings.
      </p>
      {loading && <p role="status">Loading requests…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="secondary" type="button" onClick={() => void load()}>
            Try again
          </Button>
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <Panel className="booking-empty">
          <span className="booking-empty-icon">
            <Icon name="calendar" />
          </span>
          <h2>{admin ? "No requests yet" : "Your next event starts here"}</h2>
          <p>
            {admin
              ? "New customer requests will appear here for review."
              : "Explore our packages and share your plans with the Clemora team."}
          </p>
          {!admin && onExplore && (
            <Button onClick={onExplore}>Explore packages</Button>
          )}
        </Panel>
      )}
      {items.map((item) => (
        <Panel as="article"
          className="customer-event-record booking-record"
          key={item.id}
        >
          <div className="event-record-top">
            <div>
              <Badge
                tone={
                  item.status === "declined" || item.status === "cancelled"
                    ? "danger"
                    : item.status === "accepted"
                      ? "success"
                      : "warning"
                }
              >
                {labels[item.status]}
              </Badge>
              <h2 className="customer-event-title">{item.packageName}</h2>
              <p>Request {item.reference}</p>
            </div>
          </div>
          <div className="event-record-details">
            <span>
              <small>Event type</small>
              <strong>{item.eventType}</strong>
            </span>
            <span><small>Requested dates</small><strong>{requestedSummary(item)}</strong></span>
            {item.requestedDays ? item.requestedDays.map(day => <span key={day.date}><small>Requested {preferredDateLabel(day.date)}</small><strong>{day.startsAt && day.endsAt ? `${dateLabel(day.startsAt, item.timeZone)} – ${dateLabel(day.endsAt, item.timeZone)} (${item.timeZone})` : "Time to be confirmed"}</strong><small>Operational schedule</small><OperationalSchedule day={day} /></span>) : <span><small>Estimated event length</small><strong>{durationLabel(item.estimatedDuration, item.estimatedDurationDays)}</strong></span>}
            <span>
              <small>Preferred venue</small>
              <strong>
                {item.preferredVenueLocation || "To be confirmed"}
              </strong>
            </span>
            <span>
              <small>Time zone</small>
              <strong>{item.timeZone}</strong>
            </span>
            {admin && (
              <>
                <span>
                  <small>Contact person</small>
                  <strong>{item.contactName}</strong>
                </span>
                <span>
                  <small>Phone number</small>
                  <strong>{item.phoneNumber}</strong>
                </span>
              </>
            )}
          </div>
          {admin && (
            <p>
              <strong>Special requests:</strong>{" "}
              {item.specialRequests || "None"}
            </p>
          )}
          <div className="event-record-footer">
            <span>
              <Icon name="clipboard" />
              {item.status === "accepted"
                ? "The team is processing this request."
                : "The preferred date is not reserved."}
            </span>
          </div>
          {item.statusHistory?.length > 0 && (
            <details className="booking-history">
              <summary>View status history</summary>
              <ul>
                {item.statusHistory.map((entry, index) => (
                  <li key={index}>
                    {labels[entry.status]} ·{" "}
                    {new Date(entry.createdAt).toLocaleString()}
                    {entry.reason ? ` — ${entry.reason}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {admin &&
            !readOnly &&
            !["declined", "cancelled"].includes(item.status) && (
              <StatusForm
                item={item}
                busy={busy === item.id}
                onUpdate={update}
              />
            )}
          {!admin && <Button variant="secondary" onClick={() => setSelected(item)}>View details and times</Button>}
          {!admin && onOpenChat && (
            <div className="booking-cancel">
              <Button
                variant="secondary"
                icon="users"
                onClick={() => onOpenChat(item.reference)}
              >
                Open chat
              </Button>
            </div>
          )}
          {!admin && !["declined", "cancelled"].includes(item.status) && (
            <CancelForm item={item} busy={busy === item.id} onCancel={cancel} />
          )}
        </Panel>
      ))}
      {selected && <BookingDetails item={selected} customerCanEditTimes onClose={() => setSelected(null)} onSaved={updated => { setSelected(updated); setItems(rows => rows.map(row => row.id === updated.id ? updated : row)); }} />}
    </div>
  );
}
function StatusForm({
  item,
  busy,
  onUpdate,
}: {
  item: BookingRequest;
  busy: boolean;
  onUpdate: (
    id: string,
    status: BookingStatus,
    reason: string,
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState<BookingStatus>(item.status);
  const [reason, setReason] = useState("");
  const reasonRequired =
    status === "needs_details" ||
    status === "declined" ||
    status === "cancelled";
  return (
    <form
      className="booking-status-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (reasonRequired && !reason.trim()) return;
        void onUpdate(item.id, status, reason);
      }}
    >
      <label>
        Status
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as BookingStatus)}
        >
          {Object.entries(labels).map(([value, label]) => (
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
      </label>
      <label>
        Reason {reasonRequired ? "(required)" : "(optional)"}
        <Input
          value={reason}
          maxLength={MAX_BOOKING_REASON_LENGTH}
          required={reasonRequired}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <Button variant="primary"
        type="submit"
        disabled={
          busy || status === item.status || (reasonRequired && !reason.trim())
        }
      >
        {busy ? "Saving…" : "Update status"}
      </Button>
    </form>
  );
}

function CancelForm({
  item,
  busy,
  onCancel,
}: {
  item: BookingRequest;
  busy: boolean;
  onCancel: (id: string, reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open)
    return (
      <div className="booking-cancel">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Cancel request
        </Button>
      </div>
    );
  return (
    <form
      className="booking-cancel-confirm"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim()) void onCancel(item.id, reason);
      }}
    >
      <h3>Cancel this request?</h3>
      <p>Tell the team why you are cancelling. This action cannot be undone.</p>
      <label>
        Reason for cancellation
        <Textarea
          required
          maxLength={MAX_BOOKING_REASON_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="booking-actions">
        <Button variant="secondary"
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
        >
          Keep request
        </Button>
        <Button variant="primary" type="submit" disabled={busy || !reason.trim()}>
          {busy ? "Cancelling…" : "Confirm cancellation"}
        </Button>
      </div>
    </form>
  );
}

const PAGE_SIZE = 50;
const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(
    new Date(value),
  );

function AdminBookingList() {
  const { notifyError } = useNotifications();
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [day, setDay] = useState<string | undefined>();
  const [items, setItems] = useState<BookingRequest[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pageCursor, setPageCursor] = useState<{
    value: string;
    scope: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const moreBusy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const statusFilter = status === "all" ? undefined : status;
  const monthKey = dateKey(month.getFullYear(), month.getMonth(), 1).slice(
    0,
    7,
  );
  const queryScope = JSON.stringify([
    statusFilter ?? null,
    day ?? null,
    revision,
  ]);
  const cursor = pageCursor?.scope === queryScope ? pageCursor.value : null;
  const currentScope = useRef(queryScope);
  currentScope.current = queryScope;

  useEffect(() => {
    const current = ++generation.current;
    moreBusy.current = false;
    setLoadingMore(false);
    setLoading(true);
    setError("");
    setPageCursor(null);
    setItems([]);
    getAdminBookingRequestsPage({
      status: statusFilter,
      preferredDate: day,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (
          generation.current === current &&
          currentScope.current === queryScope
        ) {
          setItems(result.bookingRequests);
          setPageCursor(
            result.nextCursor
              ? { value: result.nextCursor, scope: queryScope }
              : null,
          );
        }
      })
      .catch((cause) => {
        if (
          generation.current === current &&
          currentScope.current === queryScope
        ) {
          setError(notifyError(cause, "Unable to load requests."));
        }
      })
      .finally(() => {
        if (
          generation.current === current &&
          currentScope.current === queryScope
        )
          setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [statusFilter, day, revision, queryScope, notifyError]);
  useEffect(() => {
    let active = true;
    setCalendarError("");
    setCalendarLoading(true);
    setCounts({});
    getBookingRequestCalendar(monthKey, statusFilter)
      .then((result) => {
        if (active)
          setCounts(
            Object.fromEntries(
              result.dailyCounts.map((entry) => [
                entry.preferredDate,
                entry.count,
              ]),
            ),
          );
      })
      .catch((cause) => {
        if (active) {
          setCalendarError(notifyError(cause, "Unable to load calendar."));
        }
      })
      .finally(() => { if (active) setCalendarLoading(false); });
    return () => {
      active = false;
    };
  }, [monthKey, statusFilter, revision, notifyError]);
  const loadMore = useCallback(async () => {
    if (
      !cursor ||
      loading ||
      moreBusy.current ||
      currentScope.current !== queryScope
    )
      return;
    const current = generation.current;
    moreBusy.current = true;
    setLoadingMore(true);
    setError("");
    try {
      const result = await getAdminBookingRequestsPage({
        status: statusFilter,
        preferredDate: day,
        limit: PAGE_SIZE,
        cursor,
      });
      if (
        generation.current === current &&
        currentScope.current === queryScope
      ) {
        setItems((rows) => [...rows, ...result.bookingRequests]);
        setPageCursor(
          result.nextCursor
            ? { value: result.nextCursor, scope: queryScope }
            : null,
        );
      }
    } catch (cause) {
      if (generation.current === current && currentScope.current === queryScope) {
        setError(notifyError(cause, "Unable to load more requests."));
      }
    } finally {
      if (
        generation.current === current &&
        currentScope.current === queryScope
      ) {
        moreBusy.current = false;
        setLoadingMore(false);
      }
    }
  }, [cursor, day, loading, statusFilter, queryScope, notifyError]);
  useEffect(() => {
    if (
      !sentinel.current ||
      !cursor ||
      error ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "150px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor, error, loadMore]);
  return (
    <div className="booking-admin">
      <PageHeader
        title="Booking requests"
        description="Review requests and follow up on event details."
      />
      <Tabs
        className="booking-filter"
        variant="segmented"
        role="group"
        aria-label="Filter requests by status"
        items={[{ value: "all", label: "All" }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]}
        active={status}
        onChange={value => setStatus(value as BookingStatus | "all")}
      />
      <MonthCalendar
        className="booking-calendar"
        month={monthKey}
        onMonthChange={(value) => {
          const [year, monthNumber] = value.split("-").map(Number);
          setMonth(new Date(year, monthNumber - 1, 1));
        }}
        selectedDate={day}
        onDateSelect={(date) => setDay(current => current === date ? undefined : date)}
        counts={counts}
        countLabel="request"
        loading={calendarLoading}
        caption={<>Requests by requested event date{statusFilter ? ` · ${labels[statusFilter]}` : ""}</>}
        error={calendarError && <>{calendarError} <Button variant="secondary" onClick={() => setRevision(value => value + 1)}>Try again</Button></>}
      />
      <Panel as="section"
        className="booking-table-panel"
        aria-labelledby="booking-requests-title"
      >
        <div className="booking-table-head">
          <div>
            <h2 id="booking-requests-title">Requests</h2>
            <p>
              {day ? preferredDateLabel(day) : "All dates"} ·{" "}
              {status === "all" ? "All statuses" : labels[status]} · Newest
              first
            </p>
          </div>
          {day && (
            <Button variant="secondary" type="button" onClick={() => setDay(undefined)}>
              Clear selected date
            </Button>
          )}
        </div>
        {loading ? (
          <p role="status">Loading requests…</p>
        ) : !items.length && !error ? (
          <p>No requests match these filters.</p>
        ) : (
          <div className="booking-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Requested ↓</th>
                  <th>Requested dates</th>
                  <th>Reference</th>
                  <th>Event / package</th>
                  <th>Contact person</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} onClick={() => navigateWorkspace(adminBookingRequestPath(item.id))}>
                    <td>
                      <Button variant="secondary"
                        type="button"
                        className="booking-row-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigateWorkspace(adminBookingRequestPath(item.id));
                        }}
                        aria-label={`View request ${item.reference}`}
                      >
                        {shortDate(item.createdAt)}{" "}
                        <span aria-hidden="true">↗</span>
                      </Button>
                    </td>
                    <td>{requestedSummary(item)}</td>
                    <td>{item.reference}</td>
                    <td>
                      {item.eventType}
                      <small>{item.packageName}</small>
                    </td>
                    <td>{item.contactName}</td>
                    <td>
                      <BookingStatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && (
          <p role="alert">
            {error}{" "}
            <Button variant="secondary"
              type="button"
              onClick={() =>
                cursor ? void loadMore() : setRevision((value) => value + 1)
              }
            >
              Try again
            </Button>
          </p>
        )}
        <div className="booking-table-footer">
          <span>
            Showing {items.length} {items.length === 1 ? "request" : "requests"}
          </span>
          {cursor && (
            <Button variant="secondary"
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load more requests"}
            </Button>
          )}
          <span>Preferred dates are not reserved.</span>
        </div>
        <div ref={sentinel} aria-hidden="true" />
      </Panel>

    </div>
  );
}
export function BookingDetails({
  item,
  customerCanEditTimes = false,
  onClose,
  onSaved,
}: {
  item: BookingRequest;
  customerCanEditTimes?: boolean;
  onClose: () => void;
  onSaved: (item: BookingRequest) => void;
}) {
  const [pageTab, setPageTab] = useState("details");
  const detailsPanelId = "booking-details-details-panel";
  const packagePanelId = "booking-details-package-panel";
  const quotationPanelId = "booking-details-quotation-panel";
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      trigger?.focus();
    };
  }, []);
  return createPortal(
    <NativeDialog
      ref={dialog}
      className="booking-details-dialog"
      aria-labelledby="booking-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="booking-details-body">
        <Button size="icon" variant="light"
          type="button"
          className="booking-details-close"
          aria-label="Close request details"
          onClick={onClose}
        >
          ×
        </Button>
        <h2 id="booking-details-title">Booking request {item.reference}</h2>
        <BookingStatusBadge status={item.status} />
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
              id: "booking-details-tab-details",
              panelId: detailsPanelId,
            },
            {
              value: "package",
              label: "Package",
              id: "booking-details-tab-package",
              panelId: packagePanelId,
            },
            {
              value: "quotation",
              label: "Quotation",
              id: "booking-details-tab-quotation",
              panelId: quotationPanelId,
            },
          ]}
        />
        {pageTab === "details" && (
        <div
          id={detailsPanelId}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby="booking-details-tab-details"
        >
        <div className="booking-details-grid">
          <section>
            <h3>Event details</h3>
            <dl>
              <div>
                <dt>Event type</dt>
                <dd>{item.eventType}</dd>
              </div>
              <div>
                <dt>Original inquiry package</dt>
                <dd>{item.packageName} · {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(item.packagePrice.amountMinor / 100)} · up to {item.packageMaxGuests} guests</dd>
              </div>
              {item.requestedDays ? <div><dt>Requested dates</dt><dd>{item.requestedDays.length} {item.requestedDays.length === 1 ? "day" : "days"}</dd></div> : <><div><dt>Preferred date</dt><dd>{preferredDateLabel(item.preferredDate)}</dd></div><div><dt>Estimated length</dt><dd>{durationLabel(item.estimatedDuration, item.estimatedDurationDays)}</dd></div></>}
              {item.startsAt && (
                <div>
                  <dt>Start time</dt>
                  <dd>{dateLabel(item.startsAt, item.timeZone)}</dd>
                </div>
              )}
              {item.endsAt && (
                <div>
                  <dt>End time</dt>
                  <dd>{dateLabel(item.endsAt, item.timeZone)}</dd>
                </div>
              )}
              {(item.startsAt || item.endsAt) && (
                <div>
                  <dt>Time zone</dt>
                  <dd>{item.timeZone}</dd>
                </div>
              )}
              {item.preferredVenueLocation && (
                <div>
                  <dt>Preferred venue</dt>
                  <dd>{item.preferredVenueLocation}</dd>
                </div>
              )}
            </dl>
            <p className="booking-details-note">
              Preferred date is not reserved.
            </p>
          </section>
          <section>
            <h3>Contact</h3>
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
                <dd>{dateLabel(item.createdAt, item.timeZone)}</dd>
              </div>
            </dl>
          </section>
        </div>
        {item.requestedDays && <section><h3>Requested days</h3><p>Times use {item.timeZone}. Dates are not reserved.</p>{item.requestedDays.map(day => <RequestedDay key={day.date} item={item} day={day} editable={customerCanEditTimes && !["declined", "cancelled"].includes(item.status) && !day.eventDayId} onSaved={onSaved} />)}</section>}
        <details className="booking-history">
          <summary>Status history</summary>
          <ul>
            {item.statusHistory.map((entry, index) => (
              <li key={index}>
                {labels[entry.status]} ·{" "}
                {new Date(entry.createdAt).toLocaleString()}
                {entry.reason ? ` — ${entry.reason}` : ""}
              </li>
            ))}
          </ul>
        </details>
        </div>
        )}
        {pageTab === "package" && (
          <div
            id={packagePanelId}
            role="tabpanel"
            tabIndex={0}
            aria-labelledby="booking-details-tab-package"
          >
            <BookingPackage id={item.id} admin={false} />
          </div>
        )}
        {pageTab === "quotation" && (
          <div
            id={quotationPanelId}
            role="tabpanel"
            tabIndex={0}
            aria-labelledby="booking-details-tab-quotation"
          >
            <Quotations bookingId={item.id} admin={false} />
          </div>
        )}

      </div>
    </NativeDialog>,
    document.body,
  );
}

function RequestedDay({ item, day, editable, onSaved }: { item: BookingRequest; day: NonNullable<BookingRequest["requestedDays"]>[number]; editable: boolean; onSaved: (item: BookingRequest) => void }) {
  const { notify, notifyError } = useNotifications();
  const initialStart = localInput(day.startsAt, item.timeZone), initialEnd = localInput(day.endsAt, item.timeZone);
  const [start, setStart] = useState(initialStart.slice(11));
  const [end, setEnd] = useState(initialEnd.slice(11));
  const [nextDay, setNextDay] = useState(!!initialEnd && initialEnd.slice(0, 10) !== day.date);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const dirty = useRef(false);
  const resetTimes = (saved: typeof day) => {
    const savedStart = localInput(saved.startsAt, item.timeZone), savedEnd = localInput(saved.endsAt, item.timeZone);
    setStart(savedStart.slice(11)); setEnd(savedEnd.slice(11)); setNextDay(!!savedEnd && savedEnd.slice(0, 10) !== saved.date);
    dirty.current = false;
  };
  useEffect(() => { if (!dirty.current) resetTimes(day); }, [day.startsAt, day.endsAt, day.date, item.timeZone]);
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setStale(false); setBusy(true);
    try {
      if (!start || !end) throw new Error("Enter both start and end times.");
      const date = new Date(`${day.date}T00:00:00Z`); if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
      const startsAt = zonedInstant(`${day.date}T${start}`, item.timeZone), endsAt = zonedInstant(`${date.toISOString().slice(0, 10)}T${end}`, item.timeZone);
      if (endsAt <= startsAt) throw new Error("End time must be after start time. Select next day for an overnight event.");
      const result = await updateRequestedDayTimes(item.id, day.date, { startsAt, endsAt, expectedUpdatedAt: item.updatedAt }); dirty.current = false; onSaved(result.bookingRequest); notify("Requested-day times saved.");
    } catch (cause) { setStale(cause instanceof ApiError && cause.status === 409); setError(notifyError(cause, "Unable to save times.")); } finally { setBusy(false); }
  }
  return <Panel as="article" className="requested-day">
    <h4>{preferredDateLabel(day.date)}</h4>
    <p>Requested time: {day.startsAt && day.endsAt ? `${dateLabel(day.startsAt, item.timeZone)} – ${dateLabel(day.endsAt, item.timeZone)} (${item.timeZone})` : "Time to be confirmed"}</p>
    <p>Operational schedule: <OperationalSchedule day={day} /></p>
    {editable && <form className="requested-day-form" onSubmit={save}>
      <fieldset disabled={busy}>
        <div className="requested-day-times">
          <FormField label="Start time">{props => <Input {...props} type="time" required value={start} onChange={e => { dirty.current = true; setStart(e.target.value); }} />}</FormField>
          <FormField label="End time">{props => <Input {...props} type="time" required value={end} onChange={e => { dirty.current = true; setEnd(e.target.value); }} />}</FormField>
        </div>
        <label className="requested-day-next"><Input variant="plain" type="checkbox" checked={nextDay} onChange={e => { dirty.current = true; setNextDay(e.target.checked); }} /> <span>End on the next day</span></label>
        {error && <p role="alert">{error}</p>}
        <div className="requested-day-actions">
          {stale && <Button type="button" variant="secondary" onClick={async () => { try { const result = await getMyBookingRequest(item.id); const refreshed = result.bookingRequest.requestedDays?.find(entry => entry.date === day.date); if (refreshed) resetTimes(refreshed); onSaved(result.bookingRequest); setStale(false); setError(""); notify("Saved times refreshed.", "info"); } catch (cause) { setError(notifyError(cause, "Unable to refresh request.")); } }}>Refresh saved times</Button>}
          <Button type="submit" disabled={stale}>{busy ? "Saving…" : "Save times"}</Button>
        </div>
      </fieldset>
    </form>}
  </Panel>;
}
