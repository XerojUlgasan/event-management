// UI-only draft: one simple booking detail page, with an independent workspace per day.
// All examples are illustrative. Actions affect memory only; there are no API calls.
import React, { useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  FormField,
  Icon,
  Input,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  WorkspaceLayout,
  type BadgeTone,
} from "@event-management/ui";
import {
  RESPONSE_DEADLINE_DAYS,
  responseDeadlineForDay,
  type ResponseDeadlineDays,
} from "@event-management/contracts/event-days";
import { MAX_BOOKING_REASON_LENGTH } from "@event-management/contracts/limits/booking-requests";
import { Sidebar } from "../../apps/web/src/components/app/Sidebar";
import type { BookingStatus } from "../../apps/web/src/lib/data/booking-requests";
import type { EventDay } from "../../apps/web/src/lib/data/event-days";
import "../../apps/web/src/styles/app.css";
import "./mock.css";

type Person = {
  id: string;
  name: string;
  response: EventDay["ownAvailability"];
  assignment: EventDay["ownAssignment"];
  role: "coordinator" | "helper";
};
type Day = {
  id: string;
  date: string;
  requestedDate: string;
  start: string | null;
  end: string | null;
  endDate?: string;
  requestedTime?: string;
  status: "scheduled" | "cancelled" | "moved" | "unopened";
  staffing: EventDay["staffingStatus"];
  deadline: ResponseDeadlineDays | null;
  people: Person[];
  replacementId?: string;
};
type Example = "standard" | "waiting" | "legacy" | "moved";
type History = { status: BookingStatus; date: string; reason?: string };
const zone = "Asia/Manila";
const statusLabels: Record<BookingStatus, string> = {
  under_review: "Under review",
  needs_details: "Needs details",
  accepted: "Accepted for processing",
  declined: "Declined",
  cancelled: "Cancelled",
};
const people = (): Person[] => [
  {
    id: "maria",
    name: "Maria Santos",
    response: "available",
    assignment: { role: "coordinator", status: "confirmed" },
    role: "coordinator",
  },
  {
    id: "paolo",
    name: "Paolo Cruz",
    response: "available",
    assignment: null,
    role: "helper",
  },
  {
    id: "ana",
    name: "Ana Reyes",
    response: "unavailable",
    assignment: null,
    role: "helper",
  },
  {
    id: "joel",
    name: "Joel Garcia",
    response: null,
    assignment: null,
    role: "helper",
  },
];
function sample(example: Example): Day[] {
  if (example === "legacy") return [];
  const base: Day[] = [
    {
      id: "day19",
      date: "2026-11-19",
      requestedDate: "2026-11-19",
      start: "09:00",
      end: "18:00",
      status: "cancelled",
      staffing: "closed",
      deadline: 2,
      people: people().map((p) => ({
        ...p,
        assignment: p.assignment
          ? { ...p.assignment, status: "cancelled" }
          : null,
      })),
    },
    {
      id: "day20",
      date: "2026-11-20",
      requestedDate: "2026-11-20",
      start: "09:00",
      end: "18:00",
      status: "scheduled",
      staffing: "closed",
      deadline: 2,
      people: people(),
    },
    {
      id: "day21",
      date: "2026-11-21",
      requestedDate: "2026-11-21",
      start: example === "waiting" ? null : "09:00",
      end: example === "waiting" ? null : "18:00",
      status: example === "waiting" ? "unopened" : "scheduled",
      staffing: "open",
      deadline: example === "waiting" ? null : 2,
      people: people().map((p) => ({ ...p, assignment: null })),
    },
  ];
  if (example === "waiting")
    base[1] = {
      ...base[1],
      status: "unopened",
      deadline: null,
      staffing: "draft",
      people: people().map((p) => ({ ...p, assignment: null, response: null })),
    };
  if (example === "moved") {
    base[1] = {
      ...base[1],
      status: "moved",
      staffing: "closed",
      replacementId: "replacement",
      people: base[1].people.map((p) => ({
        ...p,
        assignment: p.assignment
          ? { ...p.assignment, status: "cancelled" }
          : null,
      })),
    };
    base.push({
      ...base[1],
      id: "replacement",
      date: "2026-11-23",
      status: "scheduled",
      staffing: "draft",
      deadline: null,
      replacementId: undefined,
      people: people().map((p) => ({
        ...p,
        response: null,
        assignment: null,
        role: "helper",
      })),
    });
  }
  return base;
}
const dateLabel = (date: string, long = false) =>
  new Intl.DateTimeFormat("en-US", {
    month: long ? "long" : "short",
    day: "numeric",
    ...(long ? { year: "numeric" } : {}),
  }).format(new Date(`${date}T12:00:00+08:00`));
const timeLabel = (time: string | null) =>
  time
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: zone,
      }).format(new Date(`2026-11-20T${time}:00+08:00`))
    : "Time to be confirmed";
const range = (day: Day) =>
  day.start && day.end
    ? `${timeLabel(day.start)} – ${timeLabel(day.end)}${(day.endDate && day.endDate !== day.date) || day.end <= day.start ? " (next day)" : ""}`
    : "Time to be confirmed";
function deadlineLabel(day: string, days: ResponseDeadlineDays) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  }).format(new Date(responseDeadlineForDay(day, days, zone)));
}
function state(day: Day): { label: string; tone: BadgeTone } {
  if (day.status === "cancelled") return { label: "Cancelled", tone: "danger" };
  if (day.status === "moved") return { label: "Moved", tone: "neutral" };
  if (day.status === "unopened")
    return {
      label: day.start ? "Not opened" : "Waiting for times",
      tone: "warning",
    };
  return {
    label:
      day.staffing === "open"
        ? "Responses open"
        : day.staffing === "closed"
          ? "Responses closed"
          : "Staffing draft",
    tone: day.staffing === "open" ? "success" : "neutral",
  };
}
function Deadline({
  value,
  onChange,
  label = "Response deadline",
  required = false,
}: {
  value: ResponseDeadlineDays | null;
  onChange: (value: ResponseDeadlineDays | null) => void;
  label?: string;
  required?: boolean;
}) {
  return (
    <FormField label={label}>
      {(props) => (
        <Select
          {...props}
          required={required}
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              RESPONSE_DEADLINE_DAYS.find(
                (d) => String(d) === e.target.value,
              ) ?? null,
            )
          }
        >
          <option value="">Select days before event</option>
          {RESPONSE_DEADLINE_DAYS.map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "day" : "days"} before
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
}
function ScheduleForm({
  day,
  onSave,
  onClose,
}: {
  day?: Day;
  onSave: (day: Day) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(day?.date ?? "2026-11-22");
  const [start, setStart] = useState(
    `${day?.date ?? "2026-11-22"}T${day?.start ?? "09:00"}`,
  );
  const [end, setEnd] = useState(
    `${day?.date ?? "2026-11-22"}T${day?.end ?? "18:00"}`,
  );
  const [staffing, setStaffing] = useState<"draft" | "open">("draft");
  const [deadline, setDeadline] = useState<ResponseDeadlineDays | null>(null);
  const [error, setError] = useState("");
  function save(e: FormEvent) {
    e.preventDefault();
    if (
      staffing === "open" &&
      deadline &&
      Date.parse(responseDeadlineForDay(date, deadline, zone)) <= Date.now()
    )
      return setError(
        "Choose a future response deadline before opening responses.",
      );
    if (start.slice(0, 10) !== date)
      return setError("The start date must match the event day.");
    if (new Date(end) <= new Date(start))
      return setError(
        "End time must be after start time. Use the next date for an overnight event.",
      );
    if (
      end.slice(0, 10) !== date &&
      new Date(end).getTime() - new Date(`${date}T00:00`).getTime() >= 172800000
    )
      return setError(
        "Use the event date or the following date for the end time.",
      );
    onSave({
      id: `draft-${Date.now()}`,
      date,
      requestedDate: day?.requestedDate ?? date,
      start: start.slice(11, 16),
      end: end.slice(11, 16),
      endDate: end.slice(0, 10),
      requestedTime: day ? (day.requestedTime ?? range(day)) : undefined,
      status: "scheduled",
      staffing,
      deadline: staffing === "open" ? deadline : null,
      people: people().map((p) => ({
        ...p,
        response: null,
        assignment: null,
        role: "helper",
      })),
    });
  }
  return (
    <form onSubmit={save} className="inline-editor">
      <h3>{day ? "Move event day" : "Add an event day"}</h3>
      <p className="muted">
        {day
          ? "The original day stays in history. Staff must respond and be selected again."
          : "For older requests whose complete requested dates were not recorded."}{" "}
        Times use {zone}.
      </p>
      <div className="schedule-fields">
        <FormField label="Event day">
          {(p) => (
            <Input
              {...p}
              type="date"
              required
              value={date}
              onInput={(e) => setDate(e.currentTarget.value)}
            />
          )}
        </FormField>
        <FormField label="Start">
          {(p) => (
            <Input
              {...p}
              type="datetime-local"
              required
              value={start}
              onInput={(e) => setStart(e.currentTarget.value)}
            />
          )}
        </FormField>
        <FormField label="End">
          {(p) => (
            <Input
              {...p}
              type="datetime-local"
              required
              value={end}
              onInput={(e) => setEnd(e.currentTarget.value)}
            />
          )}
        </FormField>
        <FormField label="Staffing">
          {(p) => (
            <Select
              {...p}
              value={staffing}
              onChange={(e) =>
                setStaffing(e.target.value === "open" ? "open" : "draft")
              }
            >
              <option value="draft">Draft</option>
              <option value="open">Open for responses</option>
            </Select>
          )}
        </FormField>
        {staffing === "open" && (
          <Deadline value={deadline} onChange={setDeadline} required />
        )}
      </div>
      {staffing === "open" && deadline && (
        <p className="muted">
          Responses close {deadlineLabel(date, deadline)}.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="actions">
        <Button type="submit">
          {day ? "Create replacement day" : "Create event day"}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
function Mock() {
  const [example, setExample] = useState<Example>("standard");
  const [days, setDays] = useState<Day[]>(() => sample("standard"));
  const [selected, setSelected] = useState("day20");
  const [status, setStatus] = useState<BookingStatus>("accepted");
  const [nextStatus, setNextStatus] = useState<BookingStatus>("accepted");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<History[]>([
    { status: "accepted", date: "Nov 11, 2026, 12:15 PM" },
    { status: "under_review", date: "Nov 11, 2026, 11:33 AM" },
  ]);
  const [batch, setBatch] = useState<ResponseDeadlineDays | null>(2);
  const [reopen, setReopen] = useState<ResponseDeadlineDays | null>(null);
  const [editStatus, setEditStatus] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(false);
  const [cancelDay, setCancelDay] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [list, setList] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const day = days.find((d) => d.id === selected);
  const accepted = status === "accepted";
  const reasonRequired = ["needs_details", "declined", "cancelled"].includes(
    nextStatus,
  );
  const terminal = status === "declined" || status === "cancelled";
  const patch = (id: string, fn: (day: Day) => Day) =>
    setDays((prev) => prev.map((d) => (d.id === id ? fn(d) : d)));
  function reset(value: Example) {
    setExample(value);
    setDays(sample(value));
    setSelected(
      value === "legacy"
        ? ""
        : value === "waiting"
          ? "day21"
          : value === "moved"
            ? "day20"
            : "day20",
    );
    setStatus("accepted");
    setNextStatus("accepted");
    setHistory([
      { status: "accepted", date: "Nov 11, 2026, 12:15 PM" },
      { status: "under_review", date: "Nov 11, 2026, 11:33 AM" },
    ]);
    setBatch(2);
    setReopen(null);
    setEditStatus(false);
    setScheduleForm(false);
    setCancelDay(null);
    setNotice("");
    setList(false);
  }
  function apply() {
    if (!batch || !accepted) return;
    if (
      days.some(
        (d) =>
          (d.status === "unopened" ||
            (d.status === "scheduled" && d.staffing === "open")) &&
          d.start &&
          Date.parse(responseDeadlineForDay(d.date, batch, zone)) <= Date.now(),
      )
    )
      return setNotice(
        "Choose a future response deadline before opening responses.",
      );
    setDays((prev) =>
      prev.map((d) =>
        d.status === "cancelled" || d.status === "moved" || !d.start || !d.end
          ? d
          : {
              ...d,
              status: "scheduled",
              deadline: batch,
              staffing: d.status === "unopened" ? "open" : d.staffing,
            },
      ),
    );
    setNotice(
      `Deadlines applied. Closed responses stay closed.${days.some((d) => !d.start) ? " Days waiting for customer times were skipped." : ""}`,
    );
  }
  function updateStatus(e: FormEvent) {
    e.preventDefault();
    setStatus(nextStatus);
    setHistory((h) => [
      {
        status: nextStatus,
        reason: reason.trim() || undefined,
        date: "Nov 11, 2026, 12:30 PM",
      },
      ...h,
    ]);
    setEditStatus(false);
    setReason("");
    if (nextStatus === "cancelled")
      setDays((prev) =>
        prev.map((d) =>
          d.status === "scheduled"
            ? {
                ...d,
                status: "cancelled",
                staffing: "closed",
                people: d.people.map((p) => ({
                  ...p,
                  assignment: p.assignment
                    ? { ...p.assignment, status: "cancelled" }
                    : null,
                })),
              }
            : d,
        ),
      );
    setNotice(
      `Request status updated to ${statusLabels[nextStatus].toLowerCase()}.`,
    );
  }
  function confirm(person: Person) {
    if (
      !day ||
      !accepted ||
      day.status !== "scheduled" ||
      day.staffing !== "closed" ||
      person.response !== "available"
    )
      return;
    if (
      person.role === "coordinator" &&
      day.people.some(
        (p) =>
          p.id !== person.id &&
          p.assignment?.role === "coordinator" &&
          p.assignment.status === "confirmed",
      )
    )
      return setNotice(
        "This day already has a confirmed coordinator. Change or cancel that assignment first.",
      );
    patch(day.id, (d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id === person.id
          ? { ...p, assignment: { role: p.role, status: "confirmed" } }
          : p,
      ),
    }));
    setNotice(
      `${person.name} confirmed as ${person.role} for ${dateLabel(day.date)}.`,
    );
  }
  function finishSchedule(created: Day) {
    setDays((prev) => [
      ...prev.map((d) =>
        day && scheduleForm && d.id === day.id
          ? {
              ...d,
              status: "moved" as const,
              staffing: "closed" as const,
              replacementId: created.id,
              people: d.people.map((p) => ({
                ...p,
                assignment: p.assignment
                  ? { ...p.assignment, status: "cancelled" as const }
                  : null,
              })),
            }
          : d,
      ),
      created,
    ]);
    setSelected(created.id);
    setScheduleForm(false);
    setNotice(
      day
        ? "Replacement day created. The original day and cancelled assignments remain in history."
        : "Event day created.",
    );
  }
  const overview = (
    <>
      <div className="request-heading">
        <PageHeader
          title="Booking request SCN-064"
          description="Reunion · Scenario Celebration 080"
        />
        <Badge
          tone={
            status === "accepted" ? "success" : terminal ? "danger" : "warning"
          }
        >
          {statusLabels[status]}
        </Badge>
      </div>
      <section className="overview">
        <div className="overview-top">
          <h2>Request details</h2>
          {!terminal && (
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                setNextStatus(status);
                setEditStatus((v) => !v);
              }}
            >
              Update status
            </Button>
          )}
        </div>
        <div className="overview-grid">
          <dl>
            <div>
              <dt>Event type</dt>
              <dd>Reunion</dd>
            </div>
            <div>
              <dt>Package</dt>
              <dd>Scenario Celebration 080</dd>
            </div>
            <div>
              <dt>
                {example === "legacy" ? "Preferred date" : "Requested dates"}
              </dt>
              <dd>
                {example === "legacy"
                  ? "Nov 22, 2026"
                  : "Nov 19–21, 2026 · 3 days"}
              </dd>
            </div>
            {example === "legacy" && (
              <div>
                <dt>Estimated length</dt>
                <dd>One day · Full date list not recorded</dd>
              </div>
            )}
          </dl>
          <dl>
            <div>
              <dt>Contact person</dt>
              <dd>Diana Aguilar</dd>
            </div>
            <div>
              <dt>Phone number</dt>
              <dd>09170000063</dd>
            </div>
            <div>
              <dt>Special requests</dt>
              <dd>None</dd>
            </div>
            <div>
              <dt>Requested</dt>
              <dd>Nov 11, 2026, 11:33 AM</dd>
            </div>
          </dl>
        </div>
        <div className="overview-bottom">
          <p>Dates are not reserved. Staffing does not confirm the booking.</p>
          <details className="history">
            <summary>Status history</summary>
            <ul>
              {history.map((h, i) => (
                <li key={i}>
                  <strong>{statusLabels[h.status]}</strong>
                  <span>
                    {h.date}
                    {h.reason ? ` · ${h.reason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
        {editStatus && (
          <form className="inline-editor" onSubmit={updateStatus}>
            <h3>Update request status</h3>
            <div className="status-fields">
              <FormField label="Status">
                {(p) => (
                  <Select
                    {...p}
                    value={nextStatus}
                    onChange={(e) => {
                      const value = Object.keys(statusLabels).find(
                        (key) => key === e.target.value,
                      );
                      if (
                        value === "accepted" ||
                        value === "needs_details" ||
                        value === "under_review" ||
                        value === "cancelled" ||
                        value === "declined"
                      )
                        setNextStatus(value);
                    }}
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option
                        key={value}
                        value={value}
                        disabled={
                          value === "under_review" && status !== "under_review"
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
                {(p) => (
                  <Textarea
                    {...p}
                    value={reason}
                    maxLength={MAX_BOOKING_REASON_LENGTH}
                    required={reasonRequired}
                    onInput={(e) => setReason(e.currentTarget.value)}
                  />
                )}
              </FormField>
            </div>
            <div className="actions">
              <Button
                type="submit"
                disabled={
                  status === nextStatus || (reasonRequired && !reason.trim())
                }
              >
                Update status
              </Button>
              <Button variant="secondary" onClick={() => setEditStatus(false)}>
                Close
              </Button>
            </div>
          </form>
        )}
      </section>
    </>
  );
  return (
    <>
      <div className="draft-bar">
        <span>
          <strong>UI draft</strong>
          <span className="draft-description">
            {" "}
            · Sample data · Changes reset on reload
          </span>
        </span>
        <div>
          <label htmlFor="example">Example</label>
          <Select
            id="example"
            value={example}
            onChange={(e) => {
              const value = e.target.value;
              if (
                value === "standard" ||
                value === "waiting" ||
                value === "legacy" ||
                value === "moved"
              )
                reset(value);
            }}
          >
            <option value="standard">Multi-day request</option>
            <option value="waiting">Waiting for customer times</option>
            <option value="moved">Moved day history</option>
            <option value="legacy">Older request</option>
          </Select>
          <Button variant="link" onClick={() => reset(example)}>
            Reset
          </Button>
        </div>
      </div>
      <WorkspaceLayout
        sidebar={
          <>
            <Sidebar
              active="Bookings"
              collapsed={!sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              onNavigate={(key) => {
                if (key === "Bookings") setList(true);
                else
                  setNotice(
                    "This UI draft covers booking requests and event days.",
                  );
                setSidebarOpen(false);
              }}
              accountMenu={
                <>
                  <Avatar initials="AD" />
                  <div>
                    <strong>Administrator</strong>
                    <small>System Administrator</small>
                  </div>
                </>
              }
            />
            {sidebarOpen && (
              <Button
                variant="plain"
                className="sidebar-scrim"
                aria-label="Close sidebar"
                onClick={() => setSidebarOpen(false)}
              />
            )}
          </>
        }
        header={
          <header className="app-header">
            <Button
              variant="plain"
              className="icon-button app-menu"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="menu" />
            </Button>
            <span className="header-location">Bookings</span>
            <div className="app-header-actions">
              <Avatar initials="AD" />
            </div>
          </header>
        }
      >
        <div className="mock-page">
          {notice && (
            <div className="feedback" role="status">
              <span>{notice}</span>
              <Button
                variant="plain"
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <Icon name="close" size={16} />
              </Button>
            </div>
          )}
          {list ? (
            <>
              <PageHeader
                title="Booking requests"
                description="Select a request to review its event days."
              />
              <section className="overview request-list">
                <div>
                  <strong>SCN-064</strong>
                  <h2>Reunion</h2>
                  <p>Diana Aguilar · Scenario Celebration 080</p>
                  <span className="muted">Nov 19–21, 2026 · 3 days</span>
                </div>
                <Badge tone="success">{statusLabels[status]}</Badge>
                <Button onClick={() => setList(false)}>View request</Button>
              </section>
            </>
          ) : (
            <>
              <div className="page-nav">
                <Button variant="link" onClick={() => setList(true)}>
                  <Icon name="chevron" size={15} className="back-chevron" />
                  Back to booking requests
                </Button>
                <Button
                  variant="link"
                  onClick={() => {
                    reset(example);
                    setNotice(
                      "Sample request and days reloaded. This is a mock refresh.",
                    );
                  }}
                >
                  Refresh request and days
                </Button>
              </div>
              {overview}
              <section className="days-section">
                <div className="section-head">
                  <div>
                    <h2>Event days</h2>
                    <p className="muted">
                      Select a day to manage its schedule and staff. All times
                      use {zone}.
                    </p>
                  </div>
                  {example === "legacy" && accepted && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelected("");
                        setScheduleForm((v) => !v);
                      }}
                    >
                      Add an event day
                    </Button>
                  )}
                </div>
                {(example !== "legacy" ||
                  days.some((d) => d.status === "scheduled")) && (
                  <div className="deadline-row">
                    <div className="deadline-controls">
                      <Deadline value={batch} onChange={setBatch} />
                      <Button
                        variant="secondary"
                        disabled={!accepted || !batch}
                        onClick={apply}
                      >
                        Apply deadlines
                      </Button>
                    </div>
                    <p className="muted">
                      Applies to all ready days. Closed responses stay closed.
                    </p>
                  </div>
                )}
                {!accepted && (
                  <p className="inline-note">
                    Accept this request for processing before opening responses
                    or confirming staff.
                  </p>
                )}
                {days.length > 0 && (
                  <Tabs
                    aria-label="Select event day"
                    className="day-selector"
                    active={selected}
                    onChange={(value) => {
                      setSelected(value);
                      setScheduleForm(false);
                      setReopen(null);
                      setNotice("");
                    }}
                    items={days.map((d) => ({
                      value: d.id,
                      label: (
                        <span className="day-tab">
                          <strong>{dateLabel(d.date)}</strong>
                          <small>{state(d).label}</small>
                        </span>
                      ),
                    }))}
                  />
                )}
                <div className="day-workspace" key={selected}>
                  {day ? (
                    <>
                      <div className="day-heading">
                        <div>
                          <h2>{dateLabel(day.date, true)}</h2>
                          <div className="day-badges">
                            <Badge
                              tone={
                                day.status === "scheduled"
                                  ? "info"
                                  : state(day).tone
                              }
                            >
                              {day.status === "scheduled"
                                ? "Scheduled"
                                : day.status === "unopened"
                                  ? "Not scheduled"
                                  : state(day).label}
                            </Badge>
                            {day.status === "scheduled" && (
                              <Badge tone={state(day).tone}>
                                {state(day).label}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {day.status === "scheduled" && (
                          <div className="actions day-actions">
                            {accepted && (
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={() => setScheduleForm((v) => !v)}
                              >
                                Move day
                              </Button>
                            )}
                            <Button
                              variant="link"
                              className="danger-link"
                              onClick={() => setCancelDay(day.id)}
                            >
                              Cancel day
                            </Button>
                          </div>
                        )}
                      </div>
                      <dl className="draft-schedule-summary">
                        <div>
                          <dt>
                            {example === "legacy"
                              ? "Preferred date"
                              : "Requested"}
                          </dt>
                          <dd>
                            {example === "legacy"
                              ? "Nov 22, 2026"
                              : `${dateLabel(day.requestedDate)} · ${day.requestedTime ?? range(day)}`}
                          </dd>
                        </div>
                        <div>
                          <dt>Operational schedule</dt>
                          <dd>
                            {day.status === "unopened"
                              ? "Not created"
                              : `${dateLabel(day.date)} · ${range(day)}`}
                          </dd>
                        </div>
                        <div>
                          <dt>Response deadline</dt>
                          <dd>
                            {day.deadline
                              ? deadlineLabel(day.date, day.deadline)
                              : "Not set"}
                          </dd>
                        </div>
                      </dl>
                      {day.status === "moved" && (
                        <p className="inline-note">
                          This day was moved. Previous assignments were
                          cancelled.{" "}
                          <Button
                            variant="link"
                            onClick={() => {
                              if (day.replacementId)
                                setSelected(day.replacementId);
                            }}
                          >
                            View replacement day
                          </Button>
                        </p>
                      )}
                      {day.status === "cancelled" && (
                        <p className="inline-note">
                          This event day is cancelled. Responses are closed and
                          assignments are cancelled.
                        </p>
                      )}
                      {day.status === "unopened" && (
                        <p className="inline-note">
                          {day.start
                            ? "The customer’s times are ready. Choose the shared response deadline above and select Apply deadlines to create this day and open responses."
                            : "Waiting for the customer to save start and end times. Apply deadlines again after their times are saved."}
                        </p>
                      )}
                      {scheduleForm &&
                        accepted &&
                        day.status === "scheduled" && (
                          <ScheduleForm
                            day={day}
                            onSave={finishSchedule}
                            onClose={() => setScheduleForm(false)}
                          />
                        )}
                      <section className="staff-section">
                        <div className="staff-header">
                          <div>
                            <h3>Staff responses and assignments</h3>
                            <p className="muted">
                              {day.status === "cancelled" ||
                              day.status === "moved"
                                ? "Previous responses and assignments are kept below."
                                : day.status === "unopened"
                                  ? "Staff will appear once this event day is opened."
                                  : day.staffing === "open"
                                    ? "Staff can respond until the deadline. Close responses before confirming assignments."
                                    : day.staffing === "draft"
                                      ? "Open responses to collect staff availability."
                                      : "Responses are closed. Confirm available staff as coordinator or helper."}
                            </p>
                          </div>
                          {accepted &&
                            day.status === "scheduled" &&
                            day.staffing === "open" && (
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  patch(day.id, (d) => ({
                                    ...d,
                                    staffing: "closed",
                                  }));
                                  setNotice(
                                    "Responses closed. You can now confirm available staff.",
                                  );
                                }}
                              >
                                Close responses
                              </Button>
                            )}
                        </div>
                        {accepted &&
                          day.status === "scheduled" &&
                          day.staffing !== "open" && (
                            <div className="reopen-row">
                              <Deadline
                                value={reopen}
                                onChange={setReopen}
                                label={
                                  day.staffing === "draft"
                                    ? "Response deadline"
                                    : "Response deadline to reopen"
                                }
                              />
                              <Button
                                variant="secondary"
                                disabled={!reopen}
                                onClick={() => {
                                  if (!reopen) return;
                                  if (
                                    Date.parse(
                                      responseDeadlineForDay(
                                        day.date,
                                        reopen,
                                        zone,
                                      ),
                                    ) <= Date.now()
                                  )
                                    return setNotice(
                                      "Choose a future response deadline before opening responses.",
                                    );
                                  patch(day.id, (d) => ({
                                    ...d,
                                    staffing: "open",
                                    deadline: reopen,
                                  }));
                                  setNotice("Responses opened for this day.");
                                }}
                              >
                                Open responses
                              </Button>
                              {reopen && (
                                <span className="muted">
                                  Closes {deadlineLabel(day.date, reopen)}
                                </span>
                              )}
                            </div>
                          )}
                        {day.status !== "unopened" && (
                          <div className="draft-staff-table-wrap">
                            <table className="draft-staff-table">
                              <thead>
                                <tr>
                                  <th scope="col">Staff member</th>
                                  <th scope="col">Response</th>
                                  <th scope="col">Role</th>
                                  <th scope="col">Assignment</th>
                                  <th scope="col">
                                    <span className="sr-only">Actions</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {day.people.map((person) => {
                                  const canAssign =
                                    accepted &&
                                    day.status === "scheduled" &&
                                    day.staffing === "closed";
                                  return (
                                    <tr key={person.id}>
                                      <th scope="row">{person.name}</th>
                                      <td data-label="Response">
                                        <Badge
                                          tone={
                                            person.response === "available"
                                              ? "success"
                                              : "neutral"
                                          }
                                        >
                                          {person.response === "available"
                                            ? "Available"
                                            : person.response === "unavailable"
                                              ? "Unavailable"
                                              : "No response"}
                                        </Badge>
                                      </td>
                                      <td data-label="Role">
                                        {canAssign ? (
                                          <Select
                                            aria-label={`Role for ${person.name}`}
                                            value={person.role}
                                            onChange={(e) => {
                                              const role =
                                                e.target.value === "coordinator"
                                                  ? "coordinator"
                                                  : "helper";
                                              patch(day.id, (d) => ({
                                                ...d,
                                                people: d.people.map((p) =>
                                                  p.id === person.id
                                                    ? { ...p, role }
                                                    : p,
                                                ),
                                              }));
                                            }}
                                          >
                                            <option value="helper">
                                              Helper
                                            </option>
                                            <option value="coordinator">
                                              Coordinator
                                            </option>
                                          </Select>
                                        ) : (
                                          <span className="capitalize">
                                            {person.assignment?.role ?? "—"}
                                          </span>
                                        )}
                                      </td>
                                      <td data-label="Assignment">
                                        {person.assignment ? (
                                          <span
                                            className={
                                              person.assignment.status ===
                                              "confirmed"
                                                ? "assignment-confirmed"
                                                : "muted"
                                            }
                                          >
                                            {person.assignment.status ===
                                            "confirmed"
                                              ? `Confirmed ${person.assignment.role}`
                                              : `Cancelled ${person.assignment.role}`}
                                          </span>
                                        ) : (
                                          <span className="muted">
                                            Not assigned
                                          </span>
                                        )}
                                      </td>
                                      <td className="staff-action-cell">
                                        <div className="person-actions">
                                          {canAssign && (
                                            <Button
                                              size="small"
                                              disabled={
                                                person.response !==
                                                  "available" ||
                                                (person.assignment?.status ===
                                                  "confirmed" &&
                                                  person.assignment.role ===
                                                    person.role)
                                              }
                                              onClick={() => confirm(person)}
                                            >
                                              {person.assignment?.status ===
                                              "confirmed"
                                                ? person.assignment.role ===
                                                  person.role
                                                  ? "Confirmed"
                                                  : "Confirm role"
                                                : "Confirm"}
                                            </Button>
                                          )}
                                          {day.status === "scheduled" &&
                                            person.assignment?.status ===
                                              "confirmed" && (
                                              <Button
                                                variant="link"
                                                size="small"
                                                onClick={() => {
                                                  patch(day.id, (d) => ({
                                                    ...d,
                                                    people: d.people.map((p) =>
                                                      p.id === person.id &&
                                                      p.assignment
                                                        ? {
                                                            ...p,
                                                            assignment: {
                                                              ...p.assignment,
                                                              status:
                                                                "cancelled",
                                                            },
                                                          }
                                                        : p,
                                                    ),
                                                  }));
                                                  setNotice(
                                                    `Assignment cancelled for ${person.name}.`,
                                                  );
                                                }}
                                              >
                                                Cancel assignment
                                              </Button>
                                            )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    </>
                  ) : scheduleForm && example === "legacy" ? (
                    <ScheduleForm
                      onSave={finishSchedule}
                      onClose={() => setScheduleForm(false)}
                    />
                  ) : (
                    <p className="inline-note">
                      No event days yet. Add a day to set its schedule and
                      collect staff availability.
                    </p>
                  )}
                </div>
              </section>
              <p className="draft-footer">
                UI mock only. Staff names and responses are illustrative;
                actions do not update a real request.
              </p>
            </>
          )}
        </div>
      </WorkspaceLayout>
      {cancelDay && (
        <Dialog
          title="Cancel this event day?"
          intro="Responses will close and confirmed assignments for this day will be cancelled. Other event days stay unchanged."
          onClose={() => setCancelDay(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setCancelDay(null)}>
                Keep day
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  patch(cancelDay, (d) => ({
                    ...d,
                    status: "cancelled",
                    staffing: "closed",
                    people: d.people.map((p) => ({
                      ...p,
                      assignment: p.assignment
                        ? { ...p.assignment, status: "cancelled" }
                        : null,
                    })),
                  }));
                  setCancelDay(null);
                  setNotice("Event day and its assignments cancelled.");
                }}
              >
                Cancel day
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Mock />);
