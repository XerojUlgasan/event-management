import { useEffect, useState, type SubmitEvent } from "react";
import {
  Badge,
  Button,
  FormField,
  Input,
  Panel,
  Select,
} from "@event-management/ui";
import type { BookingRequest } from "../../../lib/data/booking-requests";
import {
  cancelEventDay,
  createEventDay,
  getAdminEventDays,
  moveEventDay,
  setAssignment,
  updateStaffing,
  type EventDay,
  type EventDaySchedule,
} from "../../../lib/data/event-days";
import { formatEventTime } from "../../../lib/utils/event-day-time";
// Interpret wall-clock values in the booking zone, never in the administrator's browser zone.
function zonedInstant(value: string, zone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a complete date and time.");
  const desired = Date.UTC(
    +match[1],
    +match[2] - 1,
    +match[3],
    +match[4],
    +match[5],
  );
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let instant = desired;
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .map((part) => [part.type, part.value]),
    );
    const observed = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
    );
    if (observed === desired) {
      // Reject repeated local times at daylight-saving transitions instead of
      // silently choosing one of the two possible instants.
      const target = formatter.format(new Date(instant));
      for (let minutes = -180; minutes <= 180; minutes += 15) {
        if (
          minutes !== 0 &&
          formatter.format(new Date(instant + minutes * 60_000)) === target
        ) {
          throw new Error(
            `That local time occurs twice in ${zone}. Choose an unambiguous time.`,
          );
        }
      }
      return new Date(instant).toISOString();
    }
    instant += desired - observed;
  }
  throw new Error(
    `That local time does not exist in ${zone}. Choose another time.`,
  );
}
function localInput(value: string | null, zone: string) {
  if (!value) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function ScheduleForm({
  booking,
  initial,
  submit,
  label,
  busy,
}: {
  booking: BookingRequest;
  initial?: EventDay;
  submit: (body: EventDaySchedule) => void;
  label: string;
  busy: boolean;
}) {
  const zone = booking.timeZone;
  const [day, setDay] = useState(
    initial?.day ?? booking.preferredDate?.slice(0, 10) ?? "",
  );
  const [start, setStart] = useState(
    localInput(initial?.startsAt ?? booking.startsAt, zone),
  );
  const [end, setEnd] = useState(
    localInput(initial?.endsAt ?? booking.endsAt, zone),
  );
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<"draft" | "open">("draft");
  const [error, setError] = useState("");
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      if (!day || start.slice(0, 10) !== day)
        throw new Error("The start date must match the event day.");
      if (status === "open" && !deadline)
        throw new Error("Set a response deadline when opening staffing.");
      const startsAt = zonedInstant(start, zone),
        endsAt = zonedInstant(end, zone);
      if (endsAt <= startsAt)
        throw new Error("End time must be after start time.");
      submit({
        day,
        startsAt,
        endsAt,
        staffingStatus: status,
        availabilityDeadline: deadline ? zonedInstant(deadline, zone) : null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the schedule.");
    }
  };
  return (
    <form className="staffing-form" onSubmit={onSubmit}>
      <p>All times use {zone}. An end time may fall on the next day.</p>
      <div className="staffing-fields">
        <FormField label="Event day">
          {(props) => (
            <Input
              {...props}
              required
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Start">
          {(props) => (
            <Input
              {...props}
              required
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="End">
          {(props) => (
            <Input
              {...props}
              required
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Staffing">
          {(props) => (
            <Select
              {...props}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value === "open" ? "open" : "draft")
              }
            >
              <option value="draft">Draft</option>
              <option value="open">Open for responses</option>
            </Select>
          )}
        </FormField>
        <FormField label="Response deadline (required when open)">
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          )}
        </FormField>
      </div>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>
        {label}
      </Button>
    </form>
  );
}
export function AdminEventDays({ booking }: { booking: BookingRequest }) {
  const [days, setDays] = useState<EventDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState("");
  const [roles, setRoles] = useState<Record<string, "coordinator" | "helper">>(
    {},
  );
  const [deadlines, setDeadlines] = useState<Record<string, string>>({});
  const load = async () => {
    const result = await getAdminEventDays(booking.id);
    setDays(result.eventDays);
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAdminEventDays(booking.id)
      .then((result) => { if (active) setDays(result.eventDays); })
      .catch((cause) =>
        active && setError(
          cause instanceof Error ? cause.message : "Unable to load event days.",
        ),
      )
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [booking.id, booking.status, booking.updatedAt]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
      setMoving("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update staffing.",
      );
    } finally {
      setBusy(false);
    }
  };
  const accepted = booking.status === "accepted";
  if (!accepted && !loading && !error && !days.length) return null;
  return (
    <section className="staffing-admin">
      <h3>Event days and staffing</h3>
      <p>Staffing an event day does not confirm this booking request.</p>
      {loading && <p role="status">Loading event days…</p>}
      {error && <p role="alert">{error}</p>}
      {accepted && (
        <details>
          <summary>Add an event day</summary>
          <ScheduleForm
            booking={booking}
            busy={busy}
            label="Create event day"
            submit={(body) => void run(() => createEventDay(booking.id, body))}
          />
        </details>
      )}
      {!loading && !error && !days.length && <p>No event days yet.</p>}
      <div className="staffing-list">
        {days.map((day) => (
          <Panel as="article" className="staffing-card" key={day.id}>
            <div className="staffing-card-heading">
              <h4>{day.day}</h4>
              <Badge>
                {day.status} · {day.staffingStatus}
              </Badge>
            </div>
            <p>
              {formatEventTime(day.startsAt, day.timezone)} –{" "}
              {formatEventTime(day.endsAt, day.timezone)} ({day.timezone})
            </p>
            {day.availabilityDeadline && (
              <p>
                Deadline:{" "}
                {formatEventTime(day.availabilityDeadline, day.timezone)}
              </p>
            )}
            {day.replacementEventDayId && (
              <p>Moved to a replacement event day.</p>
            )}
            <h5>Responses and assignments</h5>
            {!day.eligibleStaff.length && !day.availability.length && (
              <p>No staff responses yet.</p>
            )}
            {[
              ...day.eligibleStaff,
              ...[...day.availability, ...day.assignments]
                .filter(
                  (entry, index, entries) =>
                    !day.eligibleStaff.some(
                      (staff) => staff.id === entry.staffId,
                    ) &&
                    entries.findIndex(
                      (other) => other.staffId === entry.staffId,
                    ) === index,
                )
                .map((entry) => ({
                  id: entry.staffId,
                  displayName: entry.staffName,
                })),
            ].map((staff) => {
              const eligible = day.eligibleStaff.some(
                (entry) => entry.id === staff.id,
              );
              const response = day.availability.find(
                (entry) => entry.staffId === staff.id,
              );
              const assignment = day.assignments.find(
                (entry) => entry.staffId === staff.id,
              );
              const key = `${day.id}:${staff.id}`;
              const role = roles[key] ?? assignment?.role ?? "helper";
              return (
                <div className="staffing-person" key={staff.id}>
                  <div>
                    <strong>{staff.displayName}</strong>
                    <p>
                      {response?.response ?? "No response"}
                      {assignment
                        ? ` · ${assignment.role} ${assignment.status}`
                        : ""}
                    </p>
                  </div>
                  {accepted &&
                    day.status === "scheduled" &&
                    day.staffingStatus === "closed" &&
                    eligible && (
                      <div className="staffing-actions">
                        <Select
                          aria-label={`Role for ${staff.displayName}`}
                          value={role}
                          onChange={(e) =>
                            setRoles((previous) => ({
                              ...previous,
                              [key]:
                                e.target.value === "coordinator"
                                  ? "coordinator"
                                  : "helper",
                            }))
                          }
                        >
                          <option value="helper">Helper</option>
                          <option value="coordinator">Coordinator</option>
                        </Select>
                        <Button
                          size="small"
                          disabled={busy || response?.response !== "available"}
                          onClick={() =>
                            void run(() =>
                              setAssignment(
                                day.id,
                                staff.id,
                                role,
                                "confirmed",
                              ),
                            )
                          }
                        >
                          Confirm
                        </Button>
                      </div>
                    )}
                  {day.status === "scheduled" &&
                    assignment?.status === "confirmed" && (
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            setAssignment(
                              day.id,
                              staff.id,
                              assignment.role,
                              "cancelled",
                            ),
                          )
                        }
                      >
                        Cancel assignment
                      </Button>
                    )}
                </div>
              );
            })}
            {day.status === "scheduled" && (
              <>
                <div className="staffing-actions">
                  {accepted &&
                    (day.staffingStatus === "open" ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(() => updateStaffing(day.id, "closed"))
                        }
                      >
                        Close responses
                      </Button>
                    ) : (
                      <>
                        <FormField label="New deadline (required to open)">
                          {(props) => (
                            <Input
                              {...props}
                              type="datetime-local"
                              value={deadlines[day.id] ?? ""}
                              onChange={(e) =>
                                setDeadlines((previous) => ({
                                  ...previous,
                                  [day.id]: e.target.value,
                                }))
                              }
                            />
                          )}
                        </FormField>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            try {
                              const value = deadlines[day.id];
                              if (!value)
                                throw new Error(
                                  "Set a future response deadline to open staffing.",
                                );
                              void run(() =>
                                updateStaffing(
                                  day.id,
                                  "open",
                                  zonedInstant(value, day.timezone),
                                ),
                              );
                            } catch (cause) {
                              setError(
                                cause instanceof Error
                                  ? cause.message
                                  : "Invalid deadline.",
                              );
                            }
                          }}
                        >
                          Open responses
                        </Button>
                      </>
                    ))}
                  {accepted && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setMoving(moving === day.id ? "" : day.id)}
                    >
                      Move day
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Cancel this event day and its assignments?",
                        )
                      )
                        void run(() => cancelEventDay(day.id));
                    }}
                  >
                    Cancel day
                  </Button>
                </div>
                {accepted && moving === day.id && (
                  <ScheduleForm
                    booking={booking}
                    initial={day}
                    busy={busy}
                    label="Create replacement day"
                    submit={(body) =>
                      void run(() => moveEventDay(day.id, body))
                    }
                  />
                )}
              </>
            )}
          </Panel>
        ))}
      </div>
    </section>
  );
}
