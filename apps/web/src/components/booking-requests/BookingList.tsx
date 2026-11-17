import { BookingStatusHistory } from "./BookingStatusHistory";
import { usePagination } from "../../lib/pagination/use-pagination";
import { navigateWorkspace } from "../../lib/navigation/workspace-navigation";
import { BookingPackage } from "./BookingPackage";
import { Quotations } from "../quotations/Quotations";
import { ApiError } from "../../lib/http/request";
import { getMyBookingRequest } from "../../lib/data/booking-requests/requests";
import {
  localInput,
  zonedInstant,
} from "../../lib/utils/event-days/event-day-time";
import {
  FormField,
  Input,
  NativeDialog,
  Pagination,
  Textarea,
  useNotifications,
} from "@event-management/ui";
import { MAX_BOOKING_REASON_LENGTH } from "@event-management/contracts/limits/booking-requests";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Button,
  Icon,
  MonthCalendar,
  PageHeader,
  Panel,
  Tabs,
} from "@event-management/ui";
import { durationLabel } from "../../lib/utils/booking-requests/duration";
import {
  cancelMyBookingRequest,
  updateRequestedDayTimes,
  getAdminBookingRequestsPage,
  getBookingRequestCalendar,
  getMyBookingRequests,
  type BookingRequest,
  type BookingStatus,
} from "../../lib/data/booking-requests/requests";

import {
  bookingStatusLabels as labels,
  bookingDateTime as dateLabel,
  bookingDate as preferredDateLabel,
  BookingStatusBadge,
} from "./BookingRequestDisplay";
import { CustomerEventTimeline } from "./CustomerEventTimeline";
import { latestCustomerEvent } from "../../lib/services/booking-requests/customer-event-timeline";
import { adminBookingRequestPath } from "../app/routes";

export function BookingList(props: {
  admin?: boolean;
  readOnly?: boolean;
  onExplore?: () => void;
  onOpenChat?: (reference: string) => void;
}) {
  return props.admin ? <AdminBookingList /> : <BookingCards {...props} />;
}
function requestedSummary(item: BookingRequest) {
  return item.requestedDays
    ? `${preferredDateLabel(item.requestedDays[0]?.date ?? null)}${item.requestedDays.length > 1 ? ` + ${item.requestedDays.length - 1} more` : ""}`
    : preferredDateLabel(item.preferredDate);
}
function OperationalSchedule({
  day,
}: {
  day: NonNullable<BookingRequest["requestedDays"]>[number];
}) {
  const schedule = day.operationalSchedule;
  if (!schedule)
    return (
      <span>
        {day.eventDayId ? "Operational schedule unavailable" : "Not scheduled"}
      </span>
    );
  const moved = schedule.id !== day.eventDayId;
  const status =
    schedule.status === "cancelled"
      ? "Cancelled"
      : schedule.status === "scheduled"
        ? "Scheduled"
        : schedule.status;
  return (
    <span>
      {moved ? `Moved · ${status}` : status}: {preferredDateLabel(schedule.day)}{" "}
      · {dateLabel(schedule.startsAt, schedule.timeZone)} –{" "}
      {dateLabel(schedule.endsAt, schedule.timeZone)} ({schedule.timeZone})
    </span>
  );
}
function BookingCards({
  onExplore,
  onOpenChat,
}: {
  onExplore?: () => void;
  onOpenChat?: (reference: string) => void;
}) {
  const { notify, notifyError } = useNotifications();
  const mounted = useRef(true);
  const generation = useRef(0);
  const [items, setItems] = useState<BookingRequest[]>([]);
  const [selected, setSelected] = useState<BookingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [busy, setBusy] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      mounted.current = false;
      generation.current++;
      window.clearInterval(timer);
    };
  }, []);
  const load = useCallback(
    async (cursor?: string) => {
      const current = ++generation.current;
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const result = await getMyBookingRequests(cursor);
        if (!mounted.current || generation.current !== current) return;
        setItems((rows) => {
          if (!cursor) return result.bookingRequests;
          const ids = new Set(rows.map((row) => row.id));
          return [
            ...rows,
            ...result.bookingRequests.filter((row) => !ids.has(row.id)),
          ];
        });
        setNextCursor(result.nextCursor);
      } catch (cause) {
        if (mounted.current && generation.current === current)
          setError(notifyError(cause, "Unable to load your event requests."));
      } finally {
        if (mounted.current && generation.current === current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [notifyError],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const saveItem = (updated: BookingRequest) => {
    setSelected((current) =>
      current?.id === updated.id
        ? latestCustomerEvent(current, updated)
        : current,
    );
    setItems((rows) =>
      rows.map((row) =>
        row.id === updated.id ? latestCustomerEvent(row, updated) : row,
      ),
    );
  };
  const cancel = async (id: string, reason: string) => {
    setBusy(id);
    setCancelError("");
    try {
      const result = await cancelMyBookingRequest(id, reason.trim());
      if (!mounted.current) return;
      saveItem(result.bookingRequest);
      notify("Booking request cancelled.");
    } catch (cause) {
      if (mounted.current)
        setCancelError(notifyError(cause, "Unable to cancel request."));
    } finally {
      if (mounted.current) setBusy("");
    }
  };
  return (
    <div className="customer-events-page">
      <PageHeader
        title="My events"
        description="Your plans, requested dates, and updates from the Styled by AMAC team."
        actions={
          onExplore ? (
            <Button icon="calendar" onClick={onExplore}>
              Plan an event
            </Button>
          ) : undefined
        }
      />
      <p className="customer-events-notice">
        <Icon name="info" size={17} />
        <span>
          These are booking requests. Dates and final prices need administrator
          review; acceptance is not a confirmed booking.
        </span>
      </p>
      {loading && (
        <div className="customer-events-loading" role="status">
          <span>Loading your event requests…</span>
          <div aria-hidden="true" />
          <div aria-hidden="true" />
          <div aria-hidden="true" />
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <section
          className="customer-events-empty"
          aria-labelledby="events-empty-title"
        >
          <span className="customer-events-empty-icon">
            <Icon name="calendar" size={28} />
          </span>
          <h2 id="events-empty-title">A place for every celebration</h2>
          <p>
            Planning a wedding, birthday, or get-together? Find a package and
            share your plans. Your requests and updates will appear here.
          </p>
          {onExplore && (
            <Button onClick={onExplore} icon="arrow">
              Explore packages
            </Button>
          )}
        </section>
      )}
      {!loading && items.length > 0 && (
        <>
          <p className="customer-events-caption">
            Grouped by requested date · {items.length}{" "}
            {nextCursor
              ? "requests loaded"
              : items.length === 1
                ? "request"
                : "requests"}
          </p>
          <CustomerEventTimeline
            items={items}
            now={now}
            hasMore={!!nextCursor}
            onDetails={(item) => {
              setCancelError("");
              setSelected(item);
            }}
            onOpenChat={onOpenChat}
          />
        </>
      )}
      {error && (
        <div className="customer-events-error" role="alert">
          <p>{error}</p>
          <Button
            variant="secondary"
            onClick={() => void load(nextCursor ?? undefined)}
          >
            Try again
          </Button>
        </div>
      )}
      {!loading && nextCursor && !error && (
        <div className="customer-events-load-more">
          <p>Earlier requests may include more upcoming dates.</p>
          <Button
            variant="secondary"
            pending={loadingMore}
            onClick={() => void load(nextCursor)}
          >
            {loadingMore
              ? "Loading earlier requests…"
              : "Load earlier requests"}
          </Button>
        </div>
      )}
      <p className="customer-events-live" role="status">
        {loadingMore
          ? "Loading earlier requests…"
          : !loading && items.length
            ? `${items.length} requests loaded.`
            : ""}
      </p>
      {selected && (
        <BookingDetails
          item={selected}
          customerCanEditTimes
          onClose={() => {
            if (!busy) setSelected(null);
          }}
          onSaved={saveItem}
          requestActions={
            <>
              {cancelError && <p role="alert">{cancelError}</p>}
              {!["declined", "cancelled"].includes(selected.status) && (
                <CancelForm
                  key={selected.id}
                  item={selected}
                  busy={busy === selected.id}
                  onCancel={cancel}
                />
              )}
            </>
          }
        />
      )}
    </div>
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
        <Button
          variant="secondary"
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
        >
          Keep request
        </Button>
        <Button
          variant="primary"
          type="submit"
          disabled={busy || !reason.trim()}
        >
          {busy ? "Cancelling…" : "Confirm cancellation"}
        </Button>
      </div>
    </form>
  );
}

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
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const statusFilter = status === "all" ? undefined : status;
  const monthKey = dateKey(month.getFullYear(), month.getMonth(), 1).slice(
    0,
    7,
  );
  const scope = JSON.stringify([statusFilter ?? null, day ?? null]);
  const pagination = usePagination(scope);
  const requestKey = JSON.stringify([scope, pagination.cursor]);
  const currentScope = useRef(requestKey);
  currentScope.current = requestKey;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setItems([]);
    getAdminBookingRequestsPage({
      status: statusFilter,
      preferredDate: day,
      cursor: pagination.cursor ?? undefined,
    })
      .then((result) => {
        if (active && currentScope.current === requestKey) {
          setItems(result.bookingRequests);
          setNextCursor(result.nextCursor);
          setLoadedKey(requestKey);
        }
      })
      .catch((cause) => {
        if (active && currentScope.current === requestKey)
          setError(notifyError(cause, "Unable to load requests."));
      })
      .finally(() => {
        if (active && currentScope.current === requestKey) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [statusFilter, day, requestKey, pagination.cursor, revision, notifyError]);
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
      .finally(() => {
        if (active) setCalendarLoading(false);
      });
    return () => {
      active = false;
    };
  }, [monthKey, statusFilter, revision, notifyError]);
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
        items={[
          { value: "all", label: "All" },
          ...Object.entries(labels).map(([value, label]) => ({ value, label })),
        ]}
        active={status}
        onChange={(value) => setStatus(value as BookingStatus | "all")}
      />
      <MonthCalendar
        className="booking-calendar"
        month={monthKey}
        onMonthChange={(value) => {
          const [year, monthNumber] = value.split("-").map(Number);
          setMonth(new Date(year, monthNumber - 1, 1));
        }}
        selectedDate={day}
        onDateSelect={(date) =>
          setDay((current) => (current === date ? undefined : date))
        }
        counts={counts}
        countLabel="request"
        loading={calendarLoading}
        caption={
          <>
            Requests by requested event date
            {statusFilter ? ` · ${labels[statusFilter]}` : ""}
          </>
        }
        error={
          calendarError && (
            <>
              {calendarError}{" "}
              <Button
                variant="secondary"
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </Button>
            </>
          )
        }
      />
      <Panel
        as="section"
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
            <Button
              variant="secondary"
              type="button"
              onClick={() => setDay(undefined)}
            >
              Clear selected date
            </Button>
          )}
        </div>
        {loading || loadedKey !== requestKey ? (
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
                  <tr
                    key={item.id}
                    onClick={() =>
                      navigateWorkspace(adminBookingRequestPath(item.id))
                    }
                  >
                    <td>
                      <Button
                        variant="secondary"
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
                      <small>
                        {item.packageName ?? "No catalog package selected"}
                      </small>
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
            <Button
              variant="secondary"
              type="button"
              onClick={() => setRevision((value) => value + 1)}
            >
              Try again
            </Button>
          </p>
        )}
        <div className="booking-table-footer">
          <span>
            Showing {items.length} {items.length === 1 ? "request" : "requests"}
          </span>
          <Pagination
            page={pagination.page}
            hasNextPage={loadedKey === requestKey && !!nextCursor}
            onPrevious={pagination.previous}
            onNext={() => nextCursor && pagination.next(nextCursor)}
            pending={loading || loadedKey !== requestKey}
          />
          <span>Preferred dates are not reserved.</span>
        </div>
      </Panel>
    </div>
  );
}
export function BookingDetails({
  item,
  customerCanEditTimes = false,
  onClose,
  onSaved,
  requestActions,
}: {
  item: BookingRequest;
  requestActions?: ReactNode;
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
        <Button
          size="icon"
          variant="light"
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
                    <dt>Catalog package</dt>
                    <dd>
                      {item.packageName && item.packagePrice ? (
                        <>
                          {item.packageName} ·{" "}
                          {new Intl.NumberFormat("en-PH", {
                            style: "currency",
                            currency: "PHP",
                          }).format(item.packagePrice.amountMinor / 100)}{" "}
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
                        {item.requestedDays.length === 1 ? "day" : "days"}
                      </dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt>Preferred date</dt>
                        <dd>{preferredDateLabel(item.preferredDate)}</dd>
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
            {item.requestedDays && (
              <section>
                <h3>Requested days</h3>
                <p>Times use {item.timeZone}. Dates are not reserved.</p>
                {item.requestedDays.map((day) => (
                  <RequestedDay
                    key={day.date}
                    item={item}
                    day={day}
                    editable={
                      customerCanEditTimes &&
                      !["declined", "cancelled"].includes(item.status) &&
                      !day.eventDayId
                    }
                    onSaved={onSaved}
                  />
                ))}
              </section>
            )}
            <BookingStatusHistory
              id={item.id}
              admin={false}
              revision={item.updatedAt}
              timeZone={item.timeZone}
            />
            {requestActions}
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

function RequestedDay({
  item,
  day,
  editable,
  onSaved,
}: {
  item: BookingRequest;
  day: NonNullable<BookingRequest["requestedDays"]>[number];
  editable: boolean;
  onSaved: (item: BookingRequest) => void;
}) {
  const { notify, notifyError } = useNotifications();
  const initialStart = localInput(day.startsAt, item.timeZone),
    initialEnd = localInput(day.endsAt, item.timeZone);
  const [start, setStart] = useState(initialStart.slice(11));
  const [end, setEnd] = useState(initialEnd.slice(11));
  const [nextDay, setNextDay] = useState(
    !!initialEnd && initialEnd.slice(0, 10) !== day.date,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const dirty = useRef(false);
  const resetTimes = (saved: typeof day) => {
    const savedStart = localInput(saved.startsAt, item.timeZone),
      savedEnd = localInput(saved.endsAt, item.timeZone);
    setStart(savedStart.slice(11));
    setEnd(savedEnd.slice(11));
    setNextDay(!!savedEnd && savedEnd.slice(0, 10) !== saved.date);
    dirty.current = false;
  };
  useEffect(() => {
    if (!dirty.current) resetTimes(day);
  }, [day.startsAt, day.endsAt, day.date, item.timeZone]);
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStale(false);
    setBusy(true);
    try {
      if (!start || !end) throw new Error("Enter both start and end times.");
      const date = new Date(`${day.date}T00:00:00Z`);
      if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
      const startsAt = zonedInstant(`${day.date}T${start}`, item.timeZone),
        endsAt = zonedInstant(
          `${date.toISOString().slice(0, 10)}T${end}`,
          item.timeZone,
        );
      if (endsAt <= startsAt)
        throw new Error(
          "End time must be after start time. Select next day for an overnight event.",
        );
      const result = await updateRequestedDayTimes(item.id, day.date, {
        startsAt,
        endsAt,
        expectedUpdatedAt: item.updatedAt,
      });
      dirty.current = false;
      onSaved(result.bookingRequest);
      notify("Requested-day times saved.");
    } catch (cause) {
      setStale(cause instanceof ApiError && cause.status === 409);
      setError(notifyError(cause, "Unable to save times."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel as="article" className="requested-day">
      <h4>{preferredDateLabel(day.date)}</h4>
      <p>
        Requested time:{" "}
        {day.startsAt && day.endsAt
          ? `${dateLabel(day.startsAt, item.timeZone)} – ${dateLabel(day.endsAt, item.timeZone)} (${item.timeZone})`
          : "Time to be confirmed"}
      </p>
      <p>
        Operational schedule: <OperationalSchedule day={day} />
      </p>
      {editable && (
        <form className="requested-day-form" onSubmit={save}>
          <fieldset disabled={busy}>
            <div className="requested-day-times">
              <FormField label="Start time">
                {(props) => (
                  <Input
                    {...props}
                    type="time"
                    required
                    value={start}
                    onChange={(e) => {
                      dirty.current = true;
                      setStart(e.target.value);
                    }}
                  />
                )}
              </FormField>
              <FormField label="End time">
                {(props) => (
                  <Input
                    {...props}
                    type="time"
                    required
                    value={end}
                    onChange={(e) => {
                      dirty.current = true;
                      setEnd(e.target.value);
                    }}
                  />
                )}
              </FormField>
            </div>
            <label className="requested-day-next">
              <Input
                variant="plain"
                type="checkbox"
                checked={nextDay}
                onChange={(e) => {
                  dirty.current = true;
                  setNextDay(e.target.checked);
                }}
              />{" "}
              <span>End on the next day</span>
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="requested-day-actions">
              {stale && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const result = await getMyBookingRequest(item.id);
                      const refreshed =
                        result.bookingRequest.requestedDays?.find(
                          (entry) => entry.date === day.date,
                        );
                      if (refreshed) resetTimes(refreshed);
                      onSaved(result.bookingRequest);
                      setStale(false);
                      setError("");
                      notify("Saved times refreshed.", "info");
                    } catch (cause) {
                      setError(
                        notifyError(cause, "Unable to refresh request."),
                      );
                    }
                  }}
                >
                  Refresh saved times
                </Button>
              )}
              <Button type="submit" disabled={stale}>
                {busy ? "Saving…" : "Save times"}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </Panel>
  );
}
