import { useEffect, useState } from "react";
import { Button, Panel, Tabs, useNotifications } from "@event-management/ui";
import type { BookingRequest } from "../../../../lib/data/booking-requests/requests";
import {
  getAdminEventDays,
  type EventDay,
} from "../../../../lib/data/event-days/event-days";
import { formatEventTime } from "../../../../lib/utils/event-days/event-day-time";
import { EventChecklistWorkspace } from "../../../checklists/EventChecklistWorkspace";

function dayLabel(date: string, includeYear: boolean) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function dayStatus(day: EventDay) {
  if (day.status !== "scheduled")
    return day.status === "moved"
      ? "Moved"
      : day.status === "cancelled"
        ? "Cancelled"
        : day.status;
  return "Scheduled";
}

export function AdminBookingChecklists({
  booking,
  refreshKey,
  onBusyChange,
}: {
  booking: BookingRequest;
  refreshKey: number;
  onBusyChange: (busy: boolean) => void;
}) {
  const { notifyError } = useNotifications();
  const [days, setDays] = useState<EventDay[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAdminEventDays(booking.id)
      .then((result) => {
        if (!active) return;
        const sorted = [...result.eventDays].sort(
          (a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id),
        );
        setDays(sorted);
        setSelected((previous) =>
          sorted.some((day) => day.id === previous)
            ? previous
            : ((sorted.find((day) => day.status === "scheduled") ?? sorted[0])
                ?.id ?? ""),
        );
      })
      .catch((cause) => {
        if (!active) return;
        setError(notifyError(cause, "Unable to load event days."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    booking.id,
    booking.status,
    booking.updatedAt,
    refreshKey,
    retry,
    notifyError,
  ]);

  useEffect(() => {
    onBusyChange(loading || editing);
    return () => onBusyChange(false);
  }, [loading, editing, onBusyChange]);

  const day = days.find((item) => item.id === selected);
  const multipleYears =
    new Set(days.map((item) => item.day.slice(0, 4))).size > 1;
  return (
    <section className="admin-event-days" aria-label="Booking checklists">
      <div className="admin-event-section-head">
        <h2>Checklists</h2>
      </div>
      {loading && <p role="status">Loading event days…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <Button
            variant="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </Button>
        </>
      )}
      {!loading && !error && !days.length && (
        <p>
          No operational event days yet. Prepare event days in Details after the
          request is accepted and customer times are available.
        </p>
      )}
      {!loading && !error && day && (
        <>
          <Tabs
            aria-label="Select event day"
            className="admin-event-selector"
            active={day.id}
            onChange={setSelected}
            items={days.map((item) => ({
              value: item.id,
              disabled: editing && item.id !== day.id,
              label: (
                <span>
                  <strong>{dayLabel(item.day, multipleYears)}</strong>
                  <small>{dayStatus(item)}</small>
                </span>
              ),
            }))}
          />
          <Panel as="article" className="admin-event-workspace">
            <dl className="admin-event-summary checklist-day-summary">
              <div>
                <dt>Schedule · {day.timezone}</dt>
                <dd>
                  {formatEventTime(day.startsAt, day.timezone)} –{" "}
                  {formatEventTime(day.endsAt, day.timezone)}
                </dd>
              </div>
            </dl>
            {booking.status !== "accepted" && (
              <p className="admin-event-note">
                The request must be accepted before checklist changes can be
                made.
              </p>
            )}
            {day.status !== "scheduled" && (
              <p className="admin-event-note">
                This event day is {day.status}; its checklist is read-only.
              </p>
            )}
            <EventChecklistWorkspace
              key={`${day.id}:${day.status}`}
              day={day}
              admin
              active={booking.status === "accepted"}
              onBusyChange={setEditing}
            />
          </Panel>
        </>
      )}
    </section>
  );
}
