import { RESPONSE_DEADLINE_DAYS, responseDeadlineForDay, type ResponseDeadlineDays } from "@event-management/contracts/event-days";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import {
  Badge,
  Button,
  Dialog,
  FormField,
  Input,
  Panel,
  Tabs,
  Select,
  useNotifications,
  notificationErrorMessage,
} from "@event-management/ui";
import type { BookingRequest } from "../../../lib/data/booking-requests";
import {
  cancelEventDay,
  createEventDay,
  getAdminEventDays,
  moveEventDay,
  applyResponseDeadlines,
  updateStaffing,
  type EventDay,
  type EventDaySchedule,
} from "../../../lib/data/event-days";
import { EventDayStaffTable } from "./EventDayStaffTable";
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
  onCancel,
}: {
  booking: BookingRequest;
  initial?: EventDay;
  submit: (body: EventDaySchedule) => void;
  label: string;
  busy: boolean;
  onCancel?: () => void;
}) {
  const { notifyError } = useNotifications();
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
      setError(notifyError(cause, "Check the schedule."));
    }
  };
  return (
    <form className="admin-event-editor" onSubmit={onSubmit}>
      <p>All times use {zone}. An end time may fall on the next day.</p>
      <div className="admin-event-fields">
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
      <div className="admin-event-actions"><Button type="submit" disabled={busy}>
        {label}
      </Button>{onCancel && <Button variant="secondary" disabled={busy} onClick={onCancel}>Cancel</Button>}</div>
    </form>
  );
}

type RequestedDay = NonNullable<BookingRequest["requestedDays"]>[number];
type DayEntry = { key: string; date: string; day?: EventDay; requested?: RequestedDay };

function dateLabel(date: string, includeYear = true) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: includeYear ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}
function scheduleLabel(start: string | null, end: string | null, zone: string) {
  if (!start || !end) return "Time to be confirmed";
  const startDate = localInput(start, zone).slice(0, 10);
  const endDate = localInput(end, zone).slice(0, 10);
  const time = (instant: string) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: zone }).format(new Date(instant));
  return `${dateLabel(startDate)} · ${time(start)} – ${time(end)}${startDate !== endDate ? ` (${dateLabel(endDate)}, overnight)` : ""}`;
}

function dayState(entry: DayEntry) {
  if (!entry.day) return entry.requested?.startsAt && entry.requested.endsAt ? "Not opened" : "Waiting for times";
  if (entry.day.status !== "scheduled") return entry.day.status === "moved" ? "Moved" : entry.day.status === "cancelled" ? "Cancelled" : entry.day.status;
  return entry.day.staffingStatus === "open" ? "Responses open" : entry.day.staffingStatus === "closed" ? "Responses closed" : "Staffing draft";
}

export function AdminEventDays({ booking, onBookingChanged, refreshKey = 0, onBusyChange }: { booking: BookingRequest; onBookingChanged: () => Promise<void>; refreshKey?: number; onBusyChange?: (busy: boolean) => void }) {
  const { notify, notifyError } = useNotifications();
  const [days, setDays] = useState<EventDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const loadGeneration = useRef(0);
  const loadFailure = useRef("");
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [loadedRevision, setLoadedRevision] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState("");
  const [moving, setMoving] = useState("");
  const [cancelDayId, setCancelDayId] = useState("");
  const [deadlines, setDeadlines] = useState<Record<string, ResponseDeadlineDays | null>>({});
  const [batchDays, setBatchDays] = useState<ResponseDeadlineDays | null>(null);
  const batchEdited = useRef(false);
  const revision = `${booking.id}:${booking.status}:${booking.updatedAt}`;

  useEffect(() => {
    let active = true;
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError("");
    getAdminEventDays(booking.id)
      .then(result => {
        if (!active || generation !== loadGeneration.current) return;
        setDays(result.eventDays);
        loadFailure.current = "";
        setLoadedRevision(revision);
        setStale(false);
      })
      .catch(cause => {
        if (!active || generation !== loadGeneration.current) return;
        setStale(true);
        const message = notificationErrorMessage(cause, "Unable to load event days.");
        setError(message);
        if (loadFailure.current !== message) { loadFailure.current = message; notifyError(message); }
      })
      .finally(() => { if (active && generation === loadGeneration.current) setLoading(false); });
    return () => { active = false; };
  }, [booking.id, revision, reload, refreshKey, notifyError]);
  useEffect(() => {
    onBusyChange?.(busy || loading);
    return () => onBusyChange?.(false);
  }, [busy, loading, onBusyChange]);
  useEffect(() => {
    batchEdited.current = false;
    setSelected("");
    setMoving("");
  }, [booking.id]);
  useEffect(() => {
    if (batchEdited.current || loading || loadedRevision !== revision) return;
    const active = days.filter(day => day.status === "scheduled" && day.availabilityDeadline);
    const matching = RESPONSE_DEADLINE_DAYS.filter(choice => active.length > 0 && active.every(day => {
      try { return Date.parse(responseDeadlineForDay(day.day, choice, day.timezone)) === Date.parse(day.availabilityDeadline ?? ""); }
      catch { return false; }
    }));
    setBatchDays(matching.length === 1 ? matching[0] ?? null : null);
  }, [days, loading, loadedRevision, revision]);

  const run = async (action?: () => Promise<unknown>) => {
    if (busyRef.current || (action && (busy || loading || stale || loadedRevision !== revision))) return;
    busyRef.current = true;
    loadGeneration.current++;
    setLoading(false);
    setBusy(true);
    setStale(true);
    setError("");
    let saved = false;
    try {
      if (action) { await action(); saved = true; notify("Event day changes saved."); }
      await onBookingChanged();
      setMoving("");
      setCancelDayId("");
      setReload(value => value + 1);
    } catch (cause) {
      setCancelDayId("");
      setError(notifyError(saved ? "Changes saved, but the request could not be refreshed. Please refresh and try again." : cause, "Unable to update staffing."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const locked = busy || loading || stale || loadedRevision !== revision;
  const accepted = booking.status === "accepted";
  const entries: DayEntry[] = [];
  for (const requested of booking.requestedDays ?? []) {
    if (!requested.eventDayId) entries.push({ key: `requested:${requested.date}`, date: requested.date, requested });
  }
  for (const day of days) {
    const requested = booking.requestedDays?.find(item => {
      let id = item.eventDayId;
      const seen = new Set<string>();
      while (id && !seen.has(id)) {
        if (id === day.id) return true;
        seen.add(id);
        id = days.find(candidate => candidate.id === id)?.replacementEventDayId ?? undefined;
      }
      return item.operationalSchedule?.id === day.id;
    });
    entries.push({ key: day.id, date: day.day, day, requested });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  const multipleYears = new Set(entries.map(entry => entry.date.slice(0, 4))).size > 1;
  const selectedRequestedDate = selected.startsWith("requested:") ? selected.slice("requested:".length) : "";
  const current = entries.find(entry => entry.key === selected) ?? entries.find(entry => entry.requested?.date === selectedRequestedDate && entry.day?.status === "scheduled") ?? entries.find(entry => entry.day?.status === "scheduled") ?? entries.find(entry => !entry.day) ?? entries[0];
  const day = current?.day;
  const requested = current?.requested;
  if (!booking.requestedDays && !accepted && !loading && !error && !days.length) return null;

  return <section className="admin-event-days">
    <div className="admin-event-section-head"><div><h2>Event days</h2><p>Select a day to manage its schedule and staff. All times use {booking.timeZone}.</p></div></div>
    {loading && <p role="status">Loading event days…</p>}
    {error && <p role="alert">{error}</p>}
    {stale && !loading && <Button variant="secondary" disabled={busy} onClick={() => void run()}>Refresh request and days</Button>}
    {(booking.requestedDays || days.some(item => item.status === "scheduled")) && <div className="admin-event-deadline-row">
      <div className="admin-event-controls"><DeadlineChoice value={batchDays} onChange={value => { batchEdited.current = true; setBatchDays(value); }} disabled={locked} /><Button variant="secondary" disabled={!accepted || !batchDays || locked} onClick={() => { if (batchDays) void run(() => applyResponseDeadlines({ bookingRequestId: booking.id, daysBefore: batchDays, expectedUpdatedAt: booking.updatedAt })); }}>Apply deadlines</Button></div>
      <p>Responses close at the end of each calculated date in {booking.timeZone}. Closed windows stay closed.{booking.requestedDays && " Apply again after missing times are saved."}</p>
    </div>}
    {!accepted && <p>Accept this request for processing before opening responses or confirming staff.</p>}
    {accepted && !booking.requestedDays && <details className="admin-event-legacy"><summary>Add an event day</summary><ScheduleForm booking={booking} busy={locked} label="Create event day" submit={body => void run(() => createEventDay(booking.id, body))} /></details>}
    {!loading && !entries.length && <p>No event days yet.</p>}
    {entries.length > 0 && <Tabs aria-label="Select event day" className="admin-event-selector" active={current?.key ?? ""} onChange={value => { setSelected(value); setMoving(""); }} items={entries.map(entry => ({ value: entry.key, label: <span><strong>{dateLabel(entry.date, multipleYears)}</strong><small>{dayState(entry)}</small></span> }))} />}
    {current && <Panel as="article" className="admin-event-workspace">
      <div className="admin-event-day-heading"><div><h3>{dateLabel(current.date)}</h3><div className="admin-event-actions"><Badge tone={day?.status === "scheduled" ? "info" : day?.status === "cancelled" ? "danger" : "neutral"}>{day ? day.status === "scheduled" ? "Scheduled" : dayState(current) : "Not scheduled"}</Badge>{day?.status === "scheduled" && <Badge tone={day.staffingStatus === "open" ? "success" : "neutral"}>{dayState(current)}</Badge>}</div></div>
        {day?.status === "scheduled" && <div className="admin-event-actions">{accepted && <Button variant="secondary" size="small" disabled={locked} onClick={() => setMoving(moving === day.id ? "" : day.id)}>Move day</Button>}<Button variant="link" className="admin-event-cancel" size="small" disabled={locked} onClick={() => setCancelDayId(day.id)}>Cancel day</Button></div>}
      </div>
      <dl className="admin-event-summary"><div><dt>{booking.requestedDays ? "Requested" : "Preferred date"}</dt><dd>{requested ? requested.startsAt && requested.endsAt ? scheduleLabel(requested.startsAt, requested.endsAt, booking.timeZone) : `${dateLabel(requested.date)} · Time to be confirmed` : booking.requestedDays ? "Not linked to a requested day" : booking.preferredDate ? dateLabel(booking.preferredDate.slice(0, 10)) : "Not recorded"}</dd></div><div><dt>Operational schedule</dt><dd>{day ? scheduleLabel(day.startsAt, day.endsAt, day.timezone) : "Not created"}</dd></div><div><dt>Response deadline</dt><dd>{day?.availabilityDeadline ? formatEventTime(day.availabilityDeadline, day.timezone) : "Not set"}{batchDays && (!day || day.status === "scheduled") && <small>Calculated: {deadlinePreview(current.date, batchDays, day?.timezone ?? booking.timeZone)}</small>}</dd></div></dl>
      {day?.status === "moved" && <p className="admin-event-note">This day was moved. Previous assignments were cancelled. {day.replacementEventDayId && <Button variant="link" onClick={() => setSelected(day.replacementEventDayId ?? "")}>View replacement day</Button>}</p>}
      {day?.status === "cancelled" && <p className="admin-event-note">This event day is cancelled. Responses are closed and assignments are cancelled.</p>}
      {!day && <p className="admin-event-note">{requested?.startsAt && requested.endsAt ? "The customer’s times are ready. Choose a response deadline and apply it to create this day and open responses." : "Waiting for the customer to save start and end times. Apply deadlines again after their times are saved."}</p>}
      {day && accepted && moving === day.id && day.status === "scheduled" && <ScheduleForm key={day.id} booking={booking} initial={day} busy={locked} label="Create replacement day" onCancel={() => setMoving("")} submit={body => void run(() => moveEventDay(day.id, body))} />}
      {day && <section className="admin-event-staff"><div className="admin-event-staff-head"><div><h4>Staff responses and assignments</h4><p>{day.status !== "scheduled" ? "Previous responses and assignments are kept below." : day.staffingStatus === "open" ? "Staff can respond until the deadline. Close responses before confirming assignments." : day.staffingStatus === "draft" ? "Open responses to collect staff availability." : "Responses are closed. Confirm available staff as coordinator or helper."}</p></div>{accepted && day.status === "scheduled" && day.staffingStatus === "open" && <Button variant="secondary" disabled={locked} onClick={() => void run(() => updateStaffing(day.id, "closed"))}>Close responses</Button>}</div>
        {accepted && day.status === "scheduled" && day.staffingStatus !== "open" && <div className="admin-event-reopen"><DeadlineChoice label={day.staffingStatus === "draft" ? "Response deadline" : "Response deadline to reopen"} value={deadlines[day.id] ?? null} onChange={value => setDeadlines(previous => ({ ...previous, [day.id]: value }))} disabled={locked} /><Button variant="secondary" disabled={locked || !deadlines[day.id]} onClick={() => { const value = deadlines[day.id]; if (value) void run(() => updateStaffing(day.id, "open", value)); }}>Open responses</Button>{deadlines[day.id] && <span>Closes {deadlinePreview(day.day, deadlines[day.id], day.timezone)}</span>}</div>}
        <EventDayStaffTable key={day.id} day={day} accepted={accepted} locked={locked} refreshKey={`${revision}:${reload}:${refreshKey}`} run={run} />
      </section>}
    </Panel>}
    {cancelDayId && <Dialog title="Cancel event day?" intro="This closes responses and cancels assignments for this day." onClose={() => { if (!busy) setCancelDayId(""); }} actions={<><Button variant="secondary" disabled={busy} onClick={() => setCancelDayId("")}>Keep day</Button><Button variant="danger" disabled={locked} onClick={() => void run(() => cancelEventDay(cancelDayId))}>Cancel day</Button></>} />}
  </section>;
}
