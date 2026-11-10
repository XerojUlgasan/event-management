import { RESPONSE_DEADLINE_DAYS, responseDeadlineForDay, type ResponseDeadlineDays } from "@event-management/contracts/event-days";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import {
  Badge,
  Button,
  FormField,
  Input,
  Panel,
  Select,
} from "@event-management/ui";
import { ApiError } from "../../../lib/http";
import type { BookingRequest } from "../../../lib/data/booking-requests";
import {
  cancelEventDay,
  createEventDay,
  getAdminEventDays,
  moveEventDay,
  applyResponseDeadlines,
  setAssignment,
  updateStaffing,
  type EventDay,
  type EventDaySchedule,
} from "../../../lib/data/event-days";
import { formatEventTime, zonedInstant, localInput } from "../../../lib/utils/event-day-time";
function asDays(value: string): ResponseDeadlineDays | null {
  return RESPONSE_DEADLINE_DAYS.find(days => String(days) === value) ?? null;
}
function DeadlineChoice({ value, onChange, label = "Response deadline", disabled = false }: { value: ResponseDeadlineDays | null; onChange: (value: ResponseDeadlineDays | null) => void; label?: string; disabled?: boolean }) {
  return <FormField label={label}>{props => <Select {...props} value={value ?? ""} disabled={disabled} onChange={event => onChange(asDays(event.target.value))}><option value="">Select days before event</option>{RESPONSE_DEADLINE_DAYS.map(days => <option key={days} value={days}>{days} {days === 1 ? "day" : "days"} before</option>)}</Select>}</FormField>;
}
function deadlinePreview(day: string, daysBefore: ResponseDeadlineDays | null, zone: string) {
  if (!daysBefore || !day) return "";
  try { const instant = responseDeadlineForDay(day, daysBefore, zone); return `${formatEventTime(instant, zone)} (${zone})${Date.parse(instant) <= Date.now() ? " · Passed" : ""}`; }
  catch { return "Unable to calculate deadline for this date."; }
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
  const [day, setDay] = useState(initial?.day ?? booking.preferredDate?.slice(0, 10) ?? "");
  const [start, setStart] = useState(
    localInput(initial?.startsAt ?? booking.startsAt, zone),
  );
  const [end, setEnd] = useState(
    localInput(initial?.endsAt ?? booking.endsAt, zone),
  );
  const [deadline, setDeadline] = useState<ResponseDeadlineDays | null>(null);
  const [status, setStatus] = useState<"draft" | "open">("draft");
  const [error, setError] = useState("");
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {

      if (status === "open" && !deadline)
        throw new Error("Set a response deadline when opening staffing.");
      if (!day || start.slice(0, 10) !== day) throw new Error("The start date must match the event day.");
      const startsAt = zonedInstant(start, zone), endsAt = zonedInstant(end, zone);
      if (endsAt <= startsAt)
        throw new Error("End time must be after start time.");
      submit({
        day,
        startsAt,
        endsAt,
        staffingStatus: status,
        ...(status === "open" && deadline ? { daysBefore: deadline } : {}),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the schedule.");
    }
  };
  return (
    <form className="staffing-form" onSubmit={onSubmit}>
      <p>All times use {zone}. An end time may fall on the next day.</p>
      <div className="staffing-fields">
        <FormField label="Event day">{props => <Input {...props} required type="date" value={day} onChange={e => setDay(e.target.value)} />}</FormField>
        <FormField label="Start">{props => <Input {...props} required type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />}</FormField>
        <FormField label="End">{props => <Input {...props} required type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />}</FormField>
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
        {status === "open" && <DeadlineChoice value={deadline} onChange={setDeadline} />}
        {status === "open" && deadline && <p>Deadline: {deadlinePreview(day, deadline, zone)}</p>}
      </div>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>
        {label}
      </Button>
    </form>
  );
}
export function AdminEventDays({ booking, onBookingChanged }: { booking: BookingRequest; onBookingChanged: () => Promise<void> }) {
  const [days, setDays] = useState<EventDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [moving, setMoving] = useState("");
  const [roles, setRoles] = useState<Record<string, "coordinator" | "helper">>(
    {},
  );
  const [deadlines, setDeadlines] = useState<Record<string, ResponseDeadlineDays | null>>({});
  const [batchDays, setBatchDays] = useState<ResponseDeadlineDays | null>(null);
  const batchEdited = useRef(false);
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
  useEffect(() => {
    if (batchEdited.current || loading) return;
    const active = days.filter(day => day.status === "scheduled" && day.availabilityDeadline);
    if (!active.length) { setBatchDays(null); return; }
    const matching = RESPONSE_DEADLINE_DAYS.filter(choice => active.every(day => {
      try { return Date.parse(responseDeadlineForDay(day.day, choice, day.timezone)) === Date.parse(day.availabilityDeadline ?? ""); }
      catch { return false; }
    }));
    setBatchDays(matching.length === 1 ? matching[0] ?? null : null);
  }, [days, loading]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    setStale(false);
    try {
      await action();
      await onBookingChanged();
      await load();
      setMoving("");
    } catch (cause) {
      setStale(cause instanceof ApiError && cause.status === 409);
      setError(
        cause instanceof Error ? cause.message : "Unable to update staffing.",
      );
    } finally {
      setBusy(false);
    }
  };
  const accepted = booking.status === "accepted";
  if (!booking.requestedDays && !accepted && !loading && !error && !days.length) return null;
  return (
    <section className="staffing-admin">
      <h3>Event days and staffing</h3>
      <p>Staffing an event day does not confirm this booking request.</p>
      {loading && <p role="status">Loading event days…</p>}
      {error && <p role="alert">{error}</p>}
      {stale && <Button variant="secondary" onClick={() => void run(async () => {})}>Refresh request and days</Button>}
      {(booking.requestedDays || days.some(day => day.status === "scheduled")) && <div className="staffing-form">
        <div className="staffing-fields"><DeadlineChoice value={batchDays} onChange={value => { batchEdited.current = true; setBatchDays(value); }} disabled={busy || stale} /></div>
        <p>Responses close at the end of each calculated date in {booking.timeZone}. {booking.requestedDays && "Apply again after the customer saves missing times. "}Closed staffing windows stay closed.</p>
        <Button disabled={!accepted || !batchDays || busy || stale || loading} onClick={() => { if (batchDays) void run(() => applyResponseDeadlines({ bookingRequestId: booking.id, daysBefore: batchDays, expectedUpdatedAt: booking.updatedAt })); }}>Apply deadlines</Button>
      </div>}
      {accepted && !booking.requestedDays && (
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
      {!loading && !error && !days.length && !booking.requestedDays && <p>No event days yet.</p>}
      <div className="staffing-list">
        {booking.requestedDays?.filter(day => !day.eventDayId).map(day => (
          <RequestedDayStaffing key={day.date} booking={booking} day={day} accepted={accepted} daysBefore={batchDays} />
        ))}
        {days.map((day) => (
          <Panel as="article" className="staffing-card" key={day.id}>
            <div className="staffing-card-heading">
              <h4>{day.day}</h4>
              <Badge>
                {day.status} · {day.staffingStatus}
              </Badge>
            </div>
            {booking.requestedDays?.filter(requested => requested.eventDayId === day.id || (requested.operationalSchedule?.id === day.id && requested.eventDayId !== day.id)).map(requested => <p key={requested.date}>Requested date: {requested.date}</p>)}
            <p>
              {formatEventTime(day.startsAt, day.timezone)} –{" "}
              {formatEventTime(day.endsAt, day.timezone)} ({day.timezone})
            </p>
            {day.status === "scheduled" && batchDays && <p>Calculated deadline: {deadlinePreview(day.day, batchDays, day.timezone)}</p>}
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
                        <DeadlineChoice label="Response deadline to reopen" value={deadlines[day.id] ?? null} onChange={value => setDeadlines(previous => ({ ...previous, [day.id]: value }))} disabled={busy} />
                        {deadlines[day.id] && <p>Deadline: {deadlinePreview(day.day, deadlines[day.id], day.timezone)}</p>}
                        <Button variant="secondary" disabled={busy || !deadlines[day.id]} onClick={() => { const value = deadlines[day.id]; if (value) void run(() => updateStaffing(day.id, "open", value)); }}>Open responses</Button>
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

function RequestedDayStaffing({ booking, day, accepted, daysBefore }: {
  booking: BookingRequest;
  day: NonNullable<BookingRequest["requestedDays"]>[number];
  accepted: boolean;
  daysBefore: ResponseDeadlineDays | null;
}) {
  const ready = !!day.startsAt && !!day.endsAt;
  return <Panel as="article" className="staffing-card">
    <div className="staffing-card-heading"><h4>{day.date}</h4><Badge>{ready ? "Not opened" : "Waiting for customer times"}</Badge></div>
    <p>{day.startsAt && day.endsAt ? `${formatEventTime(day.startsAt, booking.timeZone)} – ${formatEventTime(day.endsAt, booking.timeZone)} (${booking.timeZone})` : "Time to be confirmed"}</p>
    {daysBefore && <p>Calculated deadline: {deadlinePreview(day.date, daysBefore, booking.timeZone)}</p>}
    {!ready && <p>Apply deadlines again after the customer saves times for this date.</p>}
    {!accepted && <p>Accept this request before applying deadlines.</p>}
  </Panel>;
}
