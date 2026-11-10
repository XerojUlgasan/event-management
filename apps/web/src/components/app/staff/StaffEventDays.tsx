import { useEffect, useState } from "react";
import { Badge, Button, PageHeader, Panel } from "@event-management/ui";
import {
  getStaffAssignments,
  getStaffEventDays,
  respondToEventDay,
  type EventDay,
} from "../../../lib/data/event-days";
import { formatEventTime } from "../../../lib/utils/event-day-time";

export function StaffEventDays({ assignments }: { assignments: boolean }) {
  const [days, setDays] = useState<EventDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setDays(
        (await (assignments ? getStaffAssignments() : getStaffEventDays()))
          .eventDays,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load event days.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [assignments]);
  const respond = async (
    day: EventDay,
    response: "available" | "unavailable",
  ) => {
    setBusy(day.id);
    setError("");
    try {
      await respondToEventDay(day.id, response);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save your response.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="staffing-page">
      <PageHeader
        title={assignments ? "Assigned to me" : "Event days"}
        description={
          assignments
            ? "Your staffing assignments and their current status."
            : "Respond to open staffing requests for each event day."
        }
        actions={
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      {loading && <p role="status">Loading event days…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !days.length && (
        <Panel>
          <p>
            {assignments ? "No assignments yet." : "No event days available."}
          </p>
        </Panel>
      )}
      <div className="staffing-list">
        {days.map((day) => (
          <Panel as="article" key={day.id} className="staffing-card">
            <div className="staffing-card-heading">
              <h2>{day.eventType}</h2>
              <Badge>
                {day.status === "scheduled" ? day.staffingStatus : day.status}
              </Badge>
            </div>
            <p>
              <strong>{day.day}</strong> ·{" "}
              {formatEventTime(day.startsAt, day.timezone)} –{" "}
              {formatEventTime(day.endsAt, day.timezone)} ({day.timezone})
            </p>
            {day.replacementEventDayId && (
              <p>Moved to a replacement event day.</p>
            )}
            {assignments ? (
              <p>
                Assignment:{" "}
                {day.ownAssignment
                  ? `${day.ownAssignment.role} · ${day.ownAssignment.status}`
                  : "None"}
              </p>
            ) : (
              <>
                <p>Your response: {day.ownAvailability ?? "No response"}</p>
                {day.availabilityDeadline && (
                  <p>
                    Respond by{" "}
                    {formatEventTime(day.availabilityDeadline, day.timezone)}
                  </p>
                )}
                {day.ownAssignment?.status === "confirmed" && (
                  <p>
                    Already assigned to this day.
                    {day.status === "scheduled" &&
                      day.staffingStatus === "open" &&
                      " You can still respond unavailable."}
                  </p>
                )}
                {day.status === "scheduled" &&
                  day.staffingStatus === "open" && (
                    <div className="staffing-actions">
                      <Button
                        disabled={
                          !!busy || day.ownAssignment?.status === "confirmed"
                        }
                        onClick={() => void respond(day, "available")}
                      >
                        Available
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!!busy}
                        onClick={() => void respond(day, "unavailable")}
                      >
                        Unavailable
                      </Button>
                    </div>
                  )}
              </>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
