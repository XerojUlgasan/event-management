import { useState } from "react"
import {
  Badge,
  Drawer,
  Icon,
  PageHeader,
  Panel,
  SearchField,
  StatCard,
} from "@event-management/ui"

type StaffRecord = {
  id: number
  name: string
  role: string
  email: string
  phone: string
  assignment: string
  status: "Available" | "Assigned"
}

const staff: StaffRecord[] = [
  { id: 1, name: "Amina Santos", role: "Event coordinator", email: "amina@example.com", phone: "+1 555 014 3201", assignment: "Mendoza–Reyes Wedding", status: "Assigned" },
  { id: 2, name: "Jon Bell", role: "Event coordinator", email: "jon@example.com", phone: "+1 555 012 8194", assignment: "Northstar Annual Dinner", status: "Assigned" },
  { id: 3, name: "Marin Alvarez", role: "Catering lead", email: "marin@example.com", phone: "+1 555 016 7720", assignment: "No current assignment", status: "Available" },
  { id: 4, name: "Tessa Lim", role: "Venue lead", email: "tessa@example.com", phone: "+1 555 018 6054", assignment: "No current assignment", status: "Available" },
]

export function StaffsPage() {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("All staff")
  const [selected, setSelected] = useState<StaffRecord | null>(null)
  const filtered = staff.filter((person) =>
    `${person.name} ${person.role} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (status === "All staff" || person.status === status),
  )

  return (
    <div className="content-stack">
      <PageHeader
        title="Staffs"
        description="View staff roles, contact details, and current assignments."
      />
      <div className="stats-grid three">
        <StatCard label="Total staff" value={String(staff.length)} detail="In this demo directory" />
        <StatCard label="Assigned" value={String(staff.filter((person) => person.status === "Assigned").length)} detail="With a current event" />
        <StatCard label="Available" value={String(staff.filter((person) => person.status === "Available").length)} detail="No current assignment" />
      </div>
      <Panel className="customer-admin-panel">
        <div className="table-tools">
          <SearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search staff name, role, or email"
          />
          <select aria-label="Staff status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>All staff</option>
            <option>Assigned</option>
            <option>Available</option>
          </select>
        </div>
        <div className="customer-admin-table">
          <div className="staff-admin-row header">
            <span>Staff member</span><span>Role</span><span>Current assignment</span><span>Status</span><span></span>
          </div>
          {filtered.map((person) => (
            <button className="staff-admin-row" key={person.id} onClick={() => setSelected(person)}>
              <span>
                <i>{person.name.split(" ").map((part) => part[0]).join("")}</i>
                <span><strong>{person.name}</strong><small>{person.email}</small></span>
              </span>
              <span>{person.role}</span>
              <span>{person.assignment}</span>
              <Badge tone={person.status === "Assigned" ? "info" : "success"}>{person.status}</Badge>
              <Icon name="chevron" size={15} />
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">
              <Icon name="search" size={28} />
              <strong>No matching staff</strong>
              <span>Try a different search or status.</span>
            </div>
          )}
        </div>
      </Panel>
      {selected && (
        <Drawer onClose={() => setSelected(null)}>
          <Badge tone={selected.status === "Assigned" ? "info" : "success"}>{selected.status}</Badge>
          <div className="drawer-title">{selected.name}</div>
          <p>{selected.role} · Demo profile</p>
          <div className="detail-grid">
            <div><span>Email</span><strong>{selected.email}</strong></div>
            <div><span>Phone</span><strong>{selected.phone}</strong></div>
            <div><span>Role</span><strong>{selected.role}</strong></div>
            <div><span>Current assignment</span><strong>{selected.assignment}</strong></div>
          </div>
        </Drawer>
      )}
    </div>
  )
}
