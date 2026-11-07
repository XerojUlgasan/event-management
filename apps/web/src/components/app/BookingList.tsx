import { MAX_BOOKING_REASON_LENGTH } from "@event-management/contracts/limits/booking-requests";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button, Icon, PageHeader } from "@event-management/ui";
import { durationLabel } from "./BookingRequest";
import {
  ArrangementEditor,
  CustomizationQueue,
  CustomizationRequestsPanel,
} from "./BookingCustomization";
import { QuotationBuilder } from "./QuotationBuilder";
import {
  cancelMyBookingRequest,
  getAdminBookingRequests,
  getAdminBookingRequestsPage,
  getBookingRequestCalendar,
  getMyBookingRequests,
  updateBookingRequestStatus,
  type BookingRequest,
  type BookingStatus,
} from "../../lib/api";

const labels: Record<BookingStatus, string> = {
  under_review: "Under review",
  needs_details: "Needs details",
  accepted: "Accepted for processing",
  declined: "Declined",
  cancelled: "Cancelled",
};
function dateLabel(value: string | null, timeZone: string) {
  if (!value) return "To be confirmed";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(value));
  } catch {
    return "To be confirmed";
  }
}
function preferredDateLabel(value: string | null) {
  if (!value) return "To be confirmed";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? "To be confirmed"
    : new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date);
}
export function BookingList(props: {
  admin?: boolean;
  readOnly?: boolean;
  onExplore?: () => void;
  onOpenChat?: (reference: string) => void;
}) {
  return props.admin ? (
    <AdminBookingList readOnly={props.readOnly} />
  ) : (
    <BookingCards {...props} />
  );
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
  const [items, setItems] = useState<BookingRequest[]>([]);
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
      setItems(result.bookingRequests);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [admin]);
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
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to cancel request.",
      );
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
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update request.",
      );
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
          <button type="button" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="booking-empty panel">
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
        </div>
      )}
      {items.map((item) => (
        <article
          className="customer-event-record panel booking-record"
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
              <strong>{item.arrangement?.eventType ?? item.eventType}</strong>
            </span>
            <span>
              <small>Preferred date</small>
              <strong>
                {preferredDateLabel(
                  item.arrangement?.preferredDate ?? item.preferredDate,
                )}
              </strong>
            </span>
            <span>
              <small>Estimated event length</small>
              <strong>
                {durationLabel(
                  item.arrangement?.estimatedDuration ??
                    item.estimatedDuration,
                  item.arrangement?.estimatedDurationDays ??
                    item.estimatedDurationDays,
                )}
              </strong>
            </span>
            <span>
              <small>Start time</small>
              <strong>
                {dateLabel(
                  item.arrangement?.startsAt ?? item.startsAt,
                  item.timeZone,
                )}
              </strong>
            </span>
            <span>
              <small>End time</small>
              <strong>
                {dateLabel(
                  item.arrangement?.endsAt ?? item.endsAt,
                  item.timeZone,
                )}
              </strong>
            </span>
            <span>
              <small>Preferred venue</small>
              <strong>
                {item.arrangement?.preferredVenueLocation ??
                  item.preferredVenueLocation ??
                  "To be confirmed"}
              </strong>
            </span>
            <span>
              <small>Guest count</small>
              <strong>
                {item.arrangement?.guestCount ?? item.guestCount ?? "Not sure yet"}
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
        </article>
      ))}
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
        <select
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
        </select>
      </label>
      <label>
        Reason {reasonRequired ? "(required)" : "(optional)"}
        <input
          value={reason}
          maxLength={MAX_BOOKING_REASON_LENGTH}
          required={reasonRequired}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={
          busy || status === item.status || (reasonRequired && !reason.trim())
        }
      >
        {busy ? "Saving…" : "Update status"}
      </button>
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
        <textarea
          required
          maxLength={MAX_BOOKING_REASON_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="booking-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
        >
          Keep request
        </button>
        <button type="submit" disabled={busy || !reason.trim()}>
          {busy ? "Cancelling…" : "Confirm cancellation"}
        </button>
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

function AdminBookingList({ readOnly = false }: { readOnly?: boolean }) {
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
  const [selected, setSelected] = useState<BookingRequest | null>(null);
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
        )
          setError(
            cause instanceof Error ? cause.message : "Unable to load requests.",
          );
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
  }, [statusFilter, day, revision, queryScope]);
  useEffect(() => {
    let active = true;
    setCalendarError("");
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
        if (active)
          setCalendarError(
            cause instanceof Error ? cause.message : "Unable to load calendar.",
          );
      });
    return () => {
      active = false;
    };
  }, [monthKey, statusFilter, revision]);
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
      if (generation.current === current && currentScope.current === queryScope)
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load more requests.",
        );
    } finally {
      if (
        generation.current === current &&
        currentScope.current === queryScope
      ) {
        moreBusy.current = false;
        setLoadingMore(false);
      }
    }
  }, [cursor, day, loading, statusFilter, queryScope]);
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
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const moveMonth = (offset: number) =>
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  return (
    <div className="booking-admin">
      <PageHeader
        title="Booking requests"
        description="Review requests and follow up on event details."
      />
      <CustomizationQueue revision={revision} onOpen={setSelected} />
      <div
        className="booking-filter"
        role="group"
        aria-label="Filter requests by status"
      >
        {[["all", "All"], ...Object.entries(labels)].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value as BookingStatus | "all")}
          >
            {label}
          </button>
        ))}
      </div>
      <section
        className="booking-calendar panel"
        aria-labelledby="booking-calendar-title"
      >
        <div className="booking-calendar-head">
          <div className="booking-month">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
            >
              ‹
            </button>
            <h2 id="booking-calendar-title">
              {new Intl.DateTimeFormat("en-PH", {
                month: "long",
                year: "numeric",
              }).format(month)}
            </h2>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
            >
              ›
            </button>
          </div>
          <div className="booking-legend">
            <span>Fewer requests</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <i key={level} className={`booking-heat-${level}`} />
            ))}
            <span>More requests</span>
          </div>
        </div>
        <p className="booking-calendar-caption">
          Requests by preferred event date
          {statusFilter ? ` · ${labels[statusFilter]}` : ""}
        </p>
        {calendarError && (
          <p role="alert">
            {calendarError}{" "}
            <button
              type="button"
              onClick={() => setRevision((value) => value + 1)}
            >
              Try again
            </button>
          </p>
        )}
        <div className="booking-calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
            <div className="booking-weekday" key={name}>
              {name}
            </div>
          ))}
          {Array.from({ length: firstDay }, (_, index) => (
            <div className="booking-day-blank" key={`blank-${index}`} />
          ))}
          {Array.from({ length: days }, (_, index) => {
            const date = dateKey(
              month.getFullYear(),
              month.getMonth(),
              index + 1,
            );
            const count = counts[date] || 0;
            return (
              <button
                key={date}
                type="button"
                className={`booking-day booking-heat-${Math.min(count, 4)}`}
                aria-pressed={day === date}
                aria-label={`${preferredDateLabel(date)}, ${count} ${count === 1 ? "request" : "requests"}`}
                onClick={() => setDay(day === date ? undefined : date)}
              >
                <span>{index + 1}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </div>
      </section>
      <section
        className="booking-table-panel panel"
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
            <button type="button" onClick={() => setDay(undefined)}>
              Clear selected date
            </button>
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
                  <th>Preferred date</th>
                  <th>Reference</th>
                  <th>Event / package</th>
                  <th>Contact person</th>
                  <th>Changes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} onClick={() => setSelected(item)}>
                    <td>
                      <button
                        type="button"
                        className="booking-row-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelected(item);
                        }}
                        aria-label={`View request ${item.reference}`}
                      >
                        {shortDate(item.createdAt)}{" "}
                        <span aria-hidden="true">↗</span>
                      </button>
                    </td>
                    <td>{preferredDateLabel(item.preferredDate)}</td>
                    <td>{item.reference}</td>
                    <td>
                      {item.eventType}
                      <small>{item.packageName}</small>
                    </td>
                    <td>{item.contactName}</td>
                    <td>
                      {item.pendingCustomizationRequests > 0 ? (
                        <Badge tone="warning">
                          {item.pendingCustomizationRequests} pending
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
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
            <button
              type="button"
              onClick={() =>
                cursor ? void loadMore() : setRevision((value) => value + 1)
              }
            >
              Try again
            </button>
          </p>
        )}
        <div className="booking-table-footer">
          <span>
            Showing {items.length} {items.length === 1 ? "request" : "requests"}
          </span>
          {cursor && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load more requests"}
            </button>
          )}
          <span>Preferred dates are not reserved.</span>
        </div>
        <div ref={sentinel} aria-hidden="true" />
      </section>
      {selected && (
        <BookingDetails
          item={selected}
          readOnly={readOnly}
          onClose={() => setSelected(null)}
          onSaved={(item) => {
            setSelected(item);
            setRevision((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`booking-badge booking-badge-${status}`}>
      {labels[status]}
    </span>
  );
}
export function BookingDetails({
  item,
  readOnly,
  customer = false,
  conversationId,
  onClose,
  onSaved,
}: {
  item: BookingRequest;
  readOnly: boolean;
  customer?: boolean;
  conversationId?: string;
  onClose: () => void;
  onSaved: (item: BookingRequest) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"overview" | "customizations" | "quotation" | "status">("overview");
  const [status, setStatus] = useState(item.status);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reasonRequired =
    status === "needs_details" ||
    status === "declined" ||
    status === "cancelled";
  const isAdmin = !customer && !readOnly;
  const isTerminal = ["declined", "cancelled"].includes(item.status);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      trigger?.focus();
    };
  }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await updateBookingRequestStatus(
        item.id,
        status,
        reason.trim() || undefined,
      );
      onSaved(result.bookingRequest);
      setReason("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update request.",
      );
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    ...(isAdmin ? [{ key: "customizations" as const, label: "Customizations", badge: item.pendingCustomizationRequests > 0 ? item.pendingCustomizationRequests : undefined }] : []),
    ...(isAdmin ? [{ key: "quotation" as const, label: "Quotation" }] : []),
    ...(isAdmin && !isTerminal ? [{ key: "status" as const, label: "Status" }] : []),
  ];

  return createPortal(
    <dialog
      ref={dialog}
      className="booking-details-dialog"
      aria-labelledby="booking-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {/* Sticky header */}
      <div className="booking-details-header">
        <div className="booking-details-header-top">
          <div className="booking-details-header-title">
            <h2 id="booking-details-title">{item.packageName}</h2>
            <span className="booking-details-ref">Ref {item.reference}</span>
          </div>
          <div className="booking-details-header-right">
            <BookingStatusBadge status={item.status} />
            <button
              type="button"
              className="booking-details-close"
              aria-label="Close request details"
              onClick={onClose}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        {tabs.length > 1 && (
          <nav className="booking-details-tabs" aria-label="Booking sections">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`booking-details-tab${tab === t.key ? " active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.badge != null && (
                  <span className="booking-details-tab-badge">{t.badge}</span>
                )}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Scrollable body */}
      <div className="booking-details-body">
        {/* ── Overview tab ── */}
        {tab === "overview" && (
          <>
            <div className="booking-details-grid">
              <section>
                <h3>Event details</h3>
                <dl>
                  <div><dt>Event type</dt><dd>{item.arrangement?.eventType ?? item.eventType}</dd></div>
                  <div><dt>Package</dt><dd>{item.packageName}</dd></div>
                  <div>
                    <dt>Preferred date</dt>
                    <dd>{preferredDateLabel(item.arrangement?.preferredDate ?? item.preferredDate)}</dd>
                  </div>
                  <div>
                    <dt>Estimated length</dt>
                    <dd>{durationLabel(item.arrangement?.estimatedDuration ?? item.estimatedDuration, item.arrangement?.estimatedDurationDays ?? item.estimatedDurationDays)}</dd>
                  </div>
                  <div>
                    <dt>Start time</dt>
                    <dd>{dateLabel(item.arrangement?.startsAt ?? item.startsAt, item.timeZone)}</dd>
                  </div>
                  <div>
                    <dt>End time</dt>
                    <dd>{dateLabel(item.arrangement?.endsAt ?? item.endsAt, item.timeZone)}</dd>
                  </div>
                  <div><dt>Time zone</dt><dd>{item.timeZone}</dd></div>
                  <div>
                    <dt>Guest count</dt>
                    <dd>
                      {item.arrangement?.guestCount ?? item.guestCount ?? "Not sure yet"}
                      {(item.arrangement?.outOfRange ?? item.outOfRange) && (
                        <span className="booking-details-warn"> · above package max ({item.packageMaxGuests})</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Preferred venue</dt>
                    <dd>{item.arrangement?.preferredVenueLocation ?? item.preferredVenueLocation ?? "To be confirmed"}</dd>
                  </div>
                  {item.arrangement?.notes && (
                    <div><dt>Internal notes</dt><dd>{item.arrangement.notes}</dd></div>
                  )}
                </dl>
                {item.arrangement && (
                  <p className="booking-details-meta">
                    Last edited by {item.arrangement.updatedByName} · {dateLabel(item.arrangement.updatedAt, item.timeZone)}
                  </p>
                )}
                <p className="booking-details-meta">Preferred date is not reserved.</p>
                {isAdmin && <ArrangementEditor item={item} onSaved={onSaved} />}
              </section>
              <section>
                <h3>Contact</h3>
                <dl>
                  <div><dt>Contact person</dt><dd>{item.contactName}</dd></div>
                  <div><dt>Phone number</dt><dd>{item.phoneNumber}</dd></div>
                  <div><dt>Special requests</dt><dd>{item.specialRequests || "None"}</dd></div>
                  <div><dt>Submitted</dt><dd>{dateLabel(item.createdAt, item.timeZone)}</dd></div>
                </dl>
              </section>
            </div>
            <details className="booking-history">
              <summary>Status history</summary>
              <ul>
                {item.statusHistory.map((entry, index) => (
                  <li key={index}>
                    {labels[entry.status]} · {new Date(entry.createdAt).toLocaleString()}
                    {entry.reason ? ` — ${entry.reason}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}

        {/* ── Customizations tab ── */}
        {tab === "customizations" && isAdmin && (
          <CustomizationRequestsPanel
            item={item}
            admin={true}
            conversationId={conversationId}
            onSaved={onSaved}
          />
        )}

        {/* ── Quotation tab ── */}
        {tab === "quotation" && isAdmin && (
          <QuotationBuilder item={item} />
        )}

        {/* ── Status tab ── */}
        {tab === "status" && isAdmin && !isTerminal && (
          <form
            className="booking-details-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!reasonRequired || reason.trim()) void save();
            }}
          >
            <h3>Update status</h3>
            <p className="booking-details-meta">Change the review status of this booking request.</p>
            <label>
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as BookingStatus)}
              >
                {Object.entries(labels).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    disabled={value === "under_review" && item.status !== "under_review"}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reason {reasonRequired ? "(required)" : "(optional)"}
              <textarea
                value={reason}
                maxLength={MAX_BOOKING_REASON_LENGTH}
                required={reasonRequired}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {error && <p role="alert" className="booking-details-error">{error}</p>}
            <div className="booking-actions">
              <button type="button" onClick={onClose}>Close</button>
              <button
                type="submit"
                disabled={busy || status === item.status || (reasonRequired && !reason.trim())}
              >
                {busy ? "Saving…" : "Update status"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
