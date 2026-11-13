import { useEffect, useState } from "react";
import type { EventDayStaffRow } from "@event-management/contracts/event-days";
import { Badge, Button, DataTable, Pagination, Select, useNotifications } from "@event-management/ui";
import { getEventDayStaff, setAssignment, type EventDay } from "../../../lib/data/event-days";
import { usePagination } from "../../../lib/use-pagination";

export function EventDayStaffTable({ day, accepted, locked, refreshKey, run }: {
  day: EventDay; accepted: boolean; locked: boolean; refreshKey: string;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const { notifyError } = useNotifications();
  const pagination = usePagination(day.id);
  const [result, setResult] = useState<{ staff: EventDayStaffRow[]; nextCursor: string | null; key: string }>();
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [roles, setRoles] = useState<Record<string, "coordinator" | "helper">>({});
  const key = JSON.stringify([day.id, pagination.cursor, refreshKey]);
  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    getEventDayStaff(day.id, { cursor: pagination.cursor }).then(page => {
      if (active) setResult({ ...page, key });
    }).catch(cause => { if (active) setError(notifyError(cause, "Unable to load staff responses.")); })
      .finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [day.id, pagination.cursor, key, retry, notifyError]);
  const current = result?.key === key;
  const loading = pending || !current && !error;
  const rows = current ? result.staff : [];
  const disabled = locked || loading || !!error;
  return <>
    {loading && <p role="status">Loading staff responses…</p>}
    {error && <><p role="alert">{error}</p><Button variant="secondary" onClick={() => setRetry(value => value + 1)}>Try again</Button></>}
    <DataTable className="admin-event-staff-table" label="Staff responses and assignments" minWidth={850}
      emptyMessage={loading ? "Loading staff responses…" : error ? "Staff responses are unavailable." : "No staff have responded as available yet."}
      rows={rows.map(staff => ({ ...staff, role: roles[staff.staffId] ?? staff.assignment?.role ?? "helper", canAssign: accepted && day.status === "scheduled" && day.staffingStatus === "closed" && staff.eligible }))}
      rowKey={staff => staff.staffId}
      columns={[
        { key: "staff", header: "Staff member", cell: staff => staff.staffName },
        { key: "response", header: "Response", cell: () => <Badge tone="success">Available</Badge> },
        { key: "role", header: "Role", cell: staff => staff.canAssign
          ? <Select aria-label={`Role for ${staff.staffName}`} value={staff.role} disabled={disabled} onChange={event => setRoles(previous => ({ ...previous, [staff.staffId]: event.target.value === "coordinator" ? "coordinator" : "helper" }))}><option value="helper">Helper</option><option value="coordinator">Coordinator</option></Select>
          : staff.assignment?.role ?? "—" },
        { key: "assignment", header: "Assignment", cell: staff => staff.assignment ? `${staff.assignment.status === "confirmed" ? "Confirmed" : "Cancelled"} ${staff.assignment.role}` : "Not assigned" },
        { key: "actions", header: "Actions", cell: staff => <div className="admin-event-actions">
          {staff.canAssign && <Button size="small" disabled={disabled || staff.assignment?.status === "confirmed" && staff.assignment.role === staff.role} onClick={() => void run(() => setAssignment(day.id, staff.staffId, staff.role, "confirmed"))}>{staff.assignment?.status === "confirmed" ? staff.assignment.role === staff.role ? "Confirmed" : "Confirm role" : "Confirm"}</Button>}
          {day.status === "scheduled" && staff.assignment?.status === "confirmed" && <Button size="small" variant="secondary" disabled={disabled} onClick={() => void run(() => setAssignment(day.id, staff.staffId, staff.assignment?.role ?? staff.role, "cancelled"))}>Cancel assignment</Button>}
        </div> },
      ]} />
    <Pagination label="Staff response pages" page={pagination.page} hasNextPage={current && result.nextCursor !== null} pending={loading} disabled={locked}
      onPrevious={pagination.previous} onNext={() => pagination.next(current ? result.nextCursor : null)} />
    {pagination.page > 1 && !loading && !error && !rows.length && <Button variant="link" onClick={pagination.reset}>Return to first page</Button>}
  </>;
}
