import { EventChecklistWorkspace } from "../../checklists/EventChecklistWorkspace";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Avatar,
  Badge,
  Brand,
  Button,
  Drawer,
  DataTable,
  Input,
  Pagination,
  MonthCalendar,
  PageHeader,
  Panel,
  Tabs,
  useNotifications,
  notificationErrorMessage,
} from "@event-management/ui";
import {
  getStaffAssignments,
  getStaffEventDays,
  getStaffEventCalendar,
  getStaffEventDay,
  respondToEventDay,
  type EventDay,
} from "../../../lib/data/event-days/event-days";
import { usePagination } from "../../../lib/pagination/use-pagination";
import { formatEventTime } from "../../../lib/utils/event-days/event-day-time";

type Response = "available" | "unavailable";
type AvailabilityRequest = {
  dayId: string;
  response: Response;
} & (
  | { phase: "pending" }
  | { phase: "saved" }
  | { phase: "failed"; message: string }
);
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof TypeError
    ? "Unable to reach Styled by AMAC. Check your connection and try again."
    : notificationErrorMessage(cause, fallback);
const isOpen = (day: EventDay, now: number) =>
  day.status === "scheduled" &&
  day.staffingStatus === "open" &&
  (!day.availabilityDeadline ||
    new Date(day.availabilityDeadline).getTime() > now);
const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

function formatSchedule(day: EventDay) {
  const eventDate = new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day.day}T12:00:00Z`));
  const time = (value: string) =>
    new Intl.DateTimeFormat("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: day.timezone,
    }).format(new Date(value));
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: day.timezone,
  }).formatToParts(new Date(day.endsAt));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  const endDay = `${part("year")}-${part("month")}-${part("day")}`;
  return {
    eventDate,
    start: time(day.startsAt),
    end:
      endDay === day.day
        ? time(day.endsAt)
        : formatEventTime(day.endsAt, day.timezone),
  };
}

function Availability({
  day,
  now,
  request,
  onRespond,
}: {
  day: EventDay;
  now: number;
  request: AvailabilityRequest | null;
  onRespond: (day: EventDay, response: Response) => void;
}) {
  const open = isOpen(day, now);
  const busy = request?.phase === "pending";
  const current = request?.dayId === day.id ? request : null;
  return (
    <div className="staff-availability">
      {open ? (
        <div className="staff-response-actions">
          <Button
            size="small"
            variant={
              day.ownAvailability === "available" ? "primary" : "secondary"
            }
            aria-pressed={day.ownAvailability === "available"}
            icon={day.ownAvailability === "available" ? "check" : undefined}
            pending={
              current?.phase === "pending" && current.response === "available"
            }
            disabled={busy || day.ownAssignment?.status === "confirmed"}
            onClick={() => onRespond(day, "available")}
          >
            Available
          </Button>
          <Button
            size="small"
            variant={
              day.ownAvailability === "unavailable" ? "primary" : "secondary"
            }
            aria-pressed={day.ownAvailability === "unavailable"}
            icon={day.ownAvailability === "unavailable" ? "check" : undefined}
            pending={
              current?.phase === "pending" && current.response === "unavailable"
            }
            disabled={busy}
            onClick={() => onRespond(day, "unavailable")}
          >
            Unavailable
          </Button>
        </div>
      ) : (
        <span className="staff-muted">Responses closed</span>
      )}
      {current && (
        <p
          className={`staff-response-feedback${current.phase === "failed" ? " staff-response-error" : ""}`}
          role={current.phase === "failed" ? "alert" : "status"}
        >
          {current.phase === "pending"
            ? `Saving ${current.response}…`
            : current.phase === "saved"
              ? `Saved: ${label(current.response)}.`
              : current.message}
        </p>
      )}
      {day.ownAssignment?.status === "confirmed" && open && (
        <small>
          You are assigned. Responding unavailable does not cancel your
          assignment.
        </small>
      )}
    </div>
  );
}

function Details({
  day,
  onClose,
  now,
  request,
  onRespond,
  error,
}: {
  day: EventDay;
  onClose: () => void;
  now: number;
  request: AvailabilityRequest | null;
  onRespond: (day: EventDay, response: Response) => void;
  error: string;
}) {
  const team = day.assignments.filter(
    (assignment) => assignment.status === "confirmed",
  );
  return (
    <Drawer
      title={day.eventType}
      status={<Badge>{label(day.status)}</Badge>}
      onClose={onClose}
    >
      {day.replacementEventDayId && (
        <p className="staff-notice">
          This event day was moved to a replacement date.
        </p>
      )}
      {day.status === "cancelled" && (
        <p className="staff-notice">This event day was cancelled.</p>
      )}
      <dl className="staff-details">
        <div>
          <dt>Booking request</dt>
          <dd>
            {day.bookingReference} · {day.packageName}
          </dd>
        </div>
        <div>
          <dt>Event day</dt>
          <dd>{day.day}</dd>
        </div>
        <div>
          <dt>Schedule</dt>
          <dd>
            {formatEventTime(day.startsAt, day.timezone)} –{" "}
            {formatEventTime(day.endsAt, day.timezone)}
          </dd>
        </div>
        <div>
          <dt>Time zone</dt>
          <dd>{day.timezone}</dd>
        </div>
        <div>
          <dt>Staffing</dt>
          <dd>
            {day.staffingStatus === "open" && !isOpen(day, now)
              ? "Closed"
              : label(day.staffingStatus)}
          </dd>
        </div>
        <div>
          <dt>Your assignment</dt>
          <dd>
            {day.ownAssignment
              ? `${label(day.ownAssignment.role)} · ${label(day.ownAssignment.status)}`
              : "Not assigned"}
          </dd>
        </div>
        <div>
          <dt>Your response</dt>
          <dd>
            {day.ownAvailability ? label(day.ownAvailability) : "No response"}
          </dd>
        </div>
        <div>
          <dt>Response deadline</dt>
          <dd>
            {day.availabilityDeadline
              ? formatEventTime(day.availabilityDeadline, day.timezone)
              : "No deadline"}
          </dd>
        </div>
      </dl>
      <h3>Confirmed team</h3>
      {team.length ? (
        <ul className="staff-team">
          {team.map((member) => (
            <li key={member.staffId}>
              {member.staffName} <span>· {label(member.role)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="staff-muted">No confirmed team members.</p>
      )}
      <h3>Availability</h3>
      {error && (
        <p className="staff-message staff-error" role="alert">
          {error}
        </p>
      )}
      <Availability
        day={day}
        now={now}
        request={request}
        onRespond={onRespond}
      />
      {day.status === "scheduled" &&
        day.ownAssignment?.role === "coordinator" &&
        day.ownAssignment.status === "confirmed" && (
          <EventChecklistWorkspace
            key={`${day.id}:${day.assignments.find((item) => item.role === "coordinator" && item.status === "confirmed")?.assignedAt}`}
            day={day}
          />
        )}
    </Drawer>
  );
}

export function StaffWorkspaceShell({
  profile,
  path,
  onSignOut,
}: {
  profile: {
    displayName: string | null;
    email: string;
    staffRole: string | null;
  };
  path: string;
  onSignOut: () => void;
}) {
  const { notify, notifyError } = useNotifications();
  const assignments = path === "/app/assignments";
  const [days, setDays] = useState<EventDay[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [calendarCounts, setCalendarCounts] = useState<Record<string, number>>(
    {},
  );
  const [calendarKey, setCalendarKey] = useState("");
  const [availabilityRequest, setAvailabilityRequest] =
    useState<AvailabilityRequest | null>(null);
  const busy = availabilityRequest?.phase === "pending";
  const [now, setNow] = useState(Date.now());
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "responded">("all");
  const [detailId, setDetailId] = useState<string>();
  const [detail, setDetail] = useState<EventDay | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const listSequence = useRef(0);
  const calendarSequence = useRef(0);
  const detailSequence = useRef(0);
  const loadFailure = useRef("");
  const normalizedSearch = search.trim();
  const effectiveFilter = assignments ? "all" : filter;
  const scope = JSON.stringify([
    assignments,
    normalizedSearch,
    effectiveFilter,
    assignments ? null : (selectedDate ?? null),
  ]);
  const pagination = usePagination(scope);
  const pageKey = JSON.stringify([scope, pagination.cursor ?? null]);
  const currentCalendarKey = JSON.stringify([
    month,
    normalizedSearch,
    effectiveFilter,
  ]);
  const refresh = useCallback(() => {
    pagination.reset();
    setRevision((value) => value + 1);
  }, [pagination.reset]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const request = ++listSequence.current;
    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        const query = {
          cursor: pagination.cursor,
          search: normalizedSearch || undefined,
          filter: effectiveFilter,
          date: assignments ? undefined : selectedDate,
        };
        const result = await (assignments
          ? getStaffAssignments(query)
          : getStaffEventDays(query));
        if (!active || request !== listSequence.current) return;
        setDays(result.eventDays);
        setNextCursor(result.nextCursor);
        setLoadedKey(pageKey);
        setError("");
        loadFailure.current = "";
      } catch (cause) {
        if (!active || request !== listSequence.current) return;
        const message = errorMessage(cause, "Unable to load event days.");
        setError(message);
        if (loadFailure.current !== message) {
          loadFailure.current = message;
          notifyError(message);
        }
      } finally {
        if (active && request === listSequence.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
      listSequence.current++;
    };
  }, [
    assignments,
    effectiveFilter,
    normalizedSearch,
    notifyError,
    pageKey,
    pagination.cursor,
    selectedDate,
    revision,
  ]);

  useEffect(() => {
    if (assignments) return;
    const request = ++calendarSequence.current;
    let active = true;
    getStaffEventCalendar(month, {
      search: normalizedSearch || undefined,
      filter: effectiveFilter,
    })
      .then((result) => {
        if (!active || request !== calendarSequence.current) return;
        setCalendarCounts(
          Object.fromEntries(
            result.counts.map((item) => [item.day, item.count]),
          ),
        );
        setCalendarKey(currentCalendarKey);
        setCalendarError("");
      })
      .catch((cause) => {
        if (active && request === calendarSequence.current)
          setCalendarError(
            errorMessage(cause, "Unable to load calendar counts."),
          );
      });
    return () => {
      active = false;
      calendarSequence.current++;
    };
  }, [
    assignments,
    currentCalendarKey,
    effectiveFilter,
    month,
    normalizedSearch,
    revision,
  ]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      setDetailError("");
      return;
    }
    const request = ++detailSequence.current;
    let active = true;
    setDetailLoading(true);
    getStaffEventDay(detailId)
      .then((result) => {
        if (active && request === detailSequence.current) {
          setDetail(result.eventDay);
          setDetailError("");
        }
      })
      .catch((cause) => {
        if (active && request === detailSequence.current) {
          setDetail(null);
          setDetailError(errorMessage(cause, "Unable to load event details."));
        }
      })
      .finally(() => {
        if (active && request === detailSequence.current)
          setDetailLoading(false);
      });
    return () => {
      active = false;
      detailSequence.current++;
    };
  }, [detailId, revision]);

  useEffect(() => {
    const update = () => {
      if (!busyRef.current && document.visibilityState === "visible") {
        setRefreshing(true);
        setRevision((value) => value + 1);
      }
    };
    const interval = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const respond = async (day: EventDay, response: Response) => {
    if (busyRef.current || !isOpen(day, Date.now())) return;
    busyRef.current = true;
    listSequence.current++;
    detailSequence.current++;
    setAvailabilityRequest({ dayId: day.id, response, phase: "pending" });
    try {
      const result = await respondToEventDay(day.id, response);
      if (!mounted.current) return;
      setDays((previous) =>
        previous.map((item) =>
          item.id === day.id
            ? {
                ...item,
                ownAvailability: result.eventDay.ownAvailability,
                ownAssignment: result.eventDay.ownAssignment,
              }
            : item,
        ),
      );
      setDetail((previous) =>
        previous?.id === day.id
          ? {
              ...previous,
              ownAvailability: result.eventDay.ownAvailability,
              ownAssignment: result.eventDay.ownAssignment,
            }
          : previous,
      );
      setAvailabilityRequest({ dayId: day.id, response, phase: "saved" });
      notify(`Availability saved: ${response}.`);
    } catch (cause) {
      if (!mounted.current) return;
      const message = notifyError(
        cause instanceof TypeError
          ? "Unable to reach Styled by AMAC. Check your connection and try again."
          : cause,
        "Unable to save your response. Please try again.",
      );
      setAvailabilityRequest({
        dayId: day.id,
        response,
        phase: "failed",
        message,
      });
    } finally {
      busyRef.current = false;
      if (mounted.current) setRevision((value) => value + 1);
    }
  };
  const visible = loadedKey === pageKey ? days : [];
  const counts = calendarKey === currentCalendarKey ? calendarCounts : {};
  const openDetails = (id: string) => {
    setDetail(null);
    setDetailError("");
    setDetailId(id);
  };
  const name = profile.displayName || profile.email;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="staff-workspace">
      <header className="staff-header">
        <div className="staff-header-inner">
          <Brand />
          <div className="staff-identity">
            <Avatar initials={initials || "S"} size="sm" />
            <div>
              <strong>{name}</strong>
              <span>{profile.staffRole || profile.email}</span>
            </div>
            <Button variant="secondary" size="small" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
        <nav className="staff-nav" aria-label="Staff workspace">
          <a
            href="/app/events"
            aria-current={!assignments ? "page" : undefined}
          >
            Event days
          </a>
          <a
            href="/app/assignments"
            aria-current={assignments ? "page" : undefined}
          >
            Assigned to me
          </a>
        </nav>
      </header>
      <main className="staff-main">
        <PageHeader
          title={assignments ? "Assigned to me" : "Event days"}
          description={
            assignments
              ? "Review your assignments and event details."
              : "Review event days and share your availability."
          }
          actions={
            <Button
              variant="secondary"
              onClick={refresh}
              disabled={loading || refreshing || !!busy}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          }
        />
        {error && (
          <div className="staff-message staff-error" role="alert">
            {error}{" "}
            <Button variant="link" onClick={refresh}>
              Retry
            </Button>
          </div>
        )}
        {loading && <p role="status">Loading event days…</p>}
        {(loadedKey === pageKey || !error) && (
          <div
            className={
              assignments ? "staff-assignment-view" : "staff-events-layout"
            }
          >
            {!assignments && (
              <aside>
                <div className="staff-calendar">
                  <MonthCalendar
                    month={month}
                    onMonthChange={setMonth}
                    selectedDate={selectedDate}
                    onDateSelect={(date) =>
                      setSelectedDate((previous) =>
                        previous === date ? undefined : date,
                      )
                    }
                    counts={counts}
                    countLabel="event day"
                  />
                  {calendarError && (
                    <p role="alert">
                      {calendarError}{" "}
                      <Button variant="link" onClick={refresh}>
                        Retry
                      </Button>
                    </p>
                  )}
                  <p className="staff-muted">
                    Select a date to filter event days.
                  </p>
                  {selectedDate && (
                    <Button
                      variant="link"
                      onClick={() => setSelectedDate(undefined)}
                    >
                      Clear date filter ({selectedDate})
                    </Button>
                  )}
                </div>
              </aside>
            )}
            <section
              className="staff-results"
              aria-label={assignments ? "Your assignments" : "Event days list"}
            >
              <div className="staff-tools">
                <label className="staff-search">
                  Search event days
                  <Input
                    type="search"
                    maxLength={200}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by event name"
                  />
                </label>
                {!assignments && (
                  <Tabs
                    aria-label="Filter event days"
                    variant="segmented"
                    active={filter}
                    onChange={(value) =>
                      setFilter(value as "all" | "open" | "responded")
                    }
                    items={[
                      { value: "all", label: "All" },
                      { value: "open", label: "Open" },
                      { value: "responded", label: "Responded" },
                    ]}
                  />
                )}
              </div>
              {assignments ? (
                !visible.length ? (
                  <Panel>
                    <p>
                      {loading
                        ? "Loading assignments…"
                        : "No assignments match these filters."}
                    </p>
                  </Panel>
                ) : (
                  <div className="staff-card-grid">
                    {visible.map((day) => (
                      <Panel
                        as="article"
                        className="staff-assignment-card"
                        key={day.id}
                      >
                        <div className="staff-card-heading">
                          <h2>{day.eventType}</h2>
                          <Badge>
                            {day.ownAssignment
                              ? label(day.ownAssignment.status)
                              : label(day.status)}
                          </Badge>
                        </div>
                        <p>
                          Request {day.bookingReference} · {day.packageName}
                        </p>
                        <p>
                          {day.ownAssignment
                            ? label(day.ownAssignment.role)
                            : "Assignment"}
                        </p>
                        <p>
                          <strong>{day.day}</strong>
                          <br />
                          {formatEventTime(day.startsAt, day.timezone)} –{" "}
                          {formatEventTime(day.endsAt, day.timezone)}
                          <br />
                          {day.timezone}
                        </p>
                        {day.status !== "scheduled" && (
                          <p>Event day: {label(day.status)}</p>
                        )}
                        <Button
                          variant="secondary"
                          onClick={() => openDetails(day.id)}
                        >
                          {day.status === "scheduled" &&
                          day.ownAssignment?.role === "coordinator" &&
                          day.ownAssignment.status === "confirmed"
                            ? "Open checklist and details"
                            : "Show details"}
                        </Button>
                      </Panel>
                    ))}
                  </div>
                )
              ) : (
                <DataTable
                  label="Event days"
                  rows={visible}
                  rowKey={(day) => day.id}
                  minWidth={950}
                  emptyMessage={
                    loading
                      ? "Loading event days…"
                      : "No event days match these filters."
                  }
                  columns={[
                    {
                      key: "event",
                      header: "Event",
                      cell: (day) => (
                        <>
                          <strong>{day.eventType}</strong>
                          <br />
                          <span className="staff-muted">
                            Request {day.bookingReference} · {day.packageName}
                          </span>
                          <br />
                          <Button
                            variant="link"
                            onClick={() => openDetails(day.id)}
                          >
                            Show details
                          </Button>
                        </>
                      ),
                    },
                    {
                      key: "schedule",
                      header: "Schedule",
                      cell: (day) => (
                        <>
                          <strong>{formatSchedule(day).eventDate}</strong>
                          <br />
                          {formatSchedule(day).start} –{" "}
                          {formatSchedule(day).end}
                          <br />
                          <span className="staff-muted">{day.timezone}</span>
                        </>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      cell: (day) => (
                        <Badge>
                          {day.status === "scheduled"
                            ? day.staffingStatus === "open" && !isOpen(day, now)
                              ? "Closed"
                              : label(day.staffingStatus)
                            : label(day.status)}
                        </Badge>
                      ),
                    },
                    {
                      key: "response",
                      header: "My response",
                      cell: (day) =>
                        day.ownAvailability
                          ? label(day.ownAvailability)
                          : "No response",
                    },
                    {
                      key: "deadline",
                      header: "Deadline",
                      cell: (day) =>
                        day.availabilityDeadline
                          ? formatEventTime(
                              day.availabilityDeadline,
                              day.timezone,
                            )
                          : "No deadline",
                    },
                    {
                      key: "availability",
                      header: "Availability",
                      cell: (day) => (
                        <Availability
                          day={day}
                          now={now}
                          request={availabilityRequest}
                          onRespond={respond}
                        />
                      ),
                    },
                  ]}
                />
              )}
              {pagination.page > 1 && !loading && !visible.length && (
                <p>
                  These results changed.{" "}
                  <Button variant="link" onClick={refresh}>
                    Refresh from the first page
                  </Button>
                </p>
              )}
              <Pagination
                page={pagination.page}
                hasNextPage={loadedKey === pageKey && !!nextCursor}
                pending={loading}
                disabled={!!busy}
                onPrevious={pagination.previous}
                onNext={() => pagination.next(nextCursor)}
                label={assignments ? "Assignment pages" : "Event day pages"}
              />
            </section>
          </div>
        )}
      </main>
      {detailId &&
        (detail && detail.id === detailId ? (
          <Details
            day={detail}
            onClose={() => setDetailId(undefined)}
            now={now}
            request={availabilityRequest}
            onRespond={respond}
            error={detailError}
          />
        ) : (
          <Drawer title="Event details" onClose={() => setDetailId(undefined)}>
            {detailLoading ? (
              <p role="status">Loading event details…</p>
            ) : (
              <p role="alert">
                {detailError || "Event details unavailable."}{" "}
                <Button
                  variant="link"
                  onClick={() => setRevision((value) => value + 1)}
                >
                  Retry
                </Button>
              </p>
            )}
          </Drawer>
        ))}
    </div>
  );
}
