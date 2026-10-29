import { useState } from "react"
import {
  ActivityList,
  Badge,
  Drawer,
  Icon,
  PageHeader,
  Panel,
  SearchField,
  StatCard,
  Tabs,
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

type CustomerRecord = {
  id: number
  name: string
  email: string
  phone: string
  activity: string
  value: string
  status: string
}

const staff: StaffRecord[] = [
  { id: 1, name: "Amina Santos", role: "Event coordinator", email: "amina@example.com", phone: "+1 555 014 3201", assignment: "Mendoza–Reyes Wedding", status: "Assigned" },
  { id: 2, name: "Jon Bell", role: "Event coordinator", email: "jon@example.com", phone: "+1 555 012 8194", assignment: "Northstar Annual Dinner", status: "Assigned" },
  { id: 3, name: "Marin Alvarez", role: "Catering lead", email: "marin@example.com", phone: "+1 555 016 7720", assignment: "No current assignment", status: "Available" },
  { id: 4, name: "Tessa Lim", role: "Venue lead", email: "tessa@example.com", phone: "+1 555 018 6054", assignment: "No current assignment", status: "Available" },
]

const customers: CustomerRecord[] = [
  { id: 1, name: "Elena Mendoza", email: "elena@example.com", phone: "+1 555 014 2830", activity: "2 bookings", value: "₱18,240", status: "Active" },
  { id: 2, name: "Noah Williams", email: "noah@example.com", phone: "+1 555 012 8841", activity: "3 bookings", value: "₱26,580", status: "Active" },
  { id: 3, name: "Mei Harlow", email: "mei@example.com", phone: "+1 555 019 4210", activity: "1 request", value: "₱4,280", status: "New" },
  { id: 4, name: "Sofia Laurent", email: "sofia@example.com", phone: "+1 555 017 9314", activity: "2 requests", value: "₱12,900", status: "Active" },
  { id: 5, name: "Lena Park", email: "lena@example.com", phone: "+1 555 015 1174", activity: "1 booking", value: "₱6,420", status: "Active" },
]

export function StaffCustomersPage() {
  const [tab, setTab] = useState("Staff")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("All staff")
  const [selectedStaff, setSelectedStaff] = useState<StaffRecord | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null)

  const filteredStaff = staff.filter((person) =>
    `${person.name} ${person.role} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (status === "All staff" || person.status === status),
  )

  return (
    <div className="content-stack">
      <PageHeader
        title="Staff & Customers"
        description="View staff roles and customer profiles in one place."
      />
      <Tabs
        className="staff-customers-tabs"
        active={tab}
        onChange={setTab}
        items={[
          { value: "Staff", label: "Staff", count: staff.length },
          { value: "Customers", label: "Customers", count: customers.length },
        ]}
      />
      {tab === "Staff" ? (
        <>
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
              {filteredStaff.map((person) => (
                <button className="staff-admin-row" key={person.id} onClick={() => setSelectedStaff(person)}>
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
              {filteredStaff.length === 0 && (
                <div className="empty-state">
                  <Icon name="search" size={28} />
                  <strong>No matching staff</strong>
                  <span>Try a different search or status.</span>
                </div>
              )}
            </div>
          </Panel>
        </>
      ) : (
        <>
          <div className="stats-grid three">
            <StatCard label="Total customers" value="284" detail="18 added this month" />
            <StatCard label="Returning customers" value="38%" detail="108 customers" />
            <StatCard label="Active inquiries" value="24" detail="7 need a response" />
          </div>
          <Panel className="customer-admin-panel">
            <div className="table-tools">
              <SearchField placeholder="Search customer name or email" />
              <select aria-label="Customer status"><option>All customers</option><option>Active</option><option>New</option></select>
            </div>
            <div className="customer-admin-table">
              <div className="customer-admin-row header">
                <span>Customer</span><span>Activity</span><span>Lifetime value</span><span>Status</span><span></span>
              </div>
              {customers.map((customer) => (
                <button
                  className="customer-admin-row"
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <span>
                    <i>{customer.name.split(" ").map((part) => part[0]).join("")}</i>
                    <span><strong>{customer.name}</strong><small>{customer.email}</small></span>
                  </span>
                  <span>{customer.activity}</span>
                  <strong>{customer.value}</strong>
                  <Badge tone={customer.status === "New" ? "info" : "success"}>{customer.status}</Badge>
                  <Icon name="chevron" size={15} />
                </button>
              ))}
            </div>
          </Panel>
        </>
      )}
      {selectedStaff && (
        <Drawer onClose={() => setSelectedStaff(null)}>
          <Badge tone={selectedStaff.status === "Assigned" ? "info" : "success"}>{selectedStaff.status}</Badge>
          <div className="drawer-title">{selectedStaff.name}</div>
          <p>{selectedStaff.role} · Demo profile</p>
          <div className="detail-grid">
            <div><span>Email</span><strong>{selectedStaff.email}</strong></div>
            <div><span>Phone</span><strong>{selectedStaff.phone}</strong></div>
            <div><span>Role</span><strong>{selectedStaff.role}</strong></div>
            <div><span>Current assignment</span><strong>{selectedStaff.assignment}</strong></div>
          </div>
        </Drawer>
      )}
      {selectedCustomer && (
        <Drawer onClose={() => setSelectedCustomer(null)}>
          <Badge tone={selectedCustomer.status === "New" ? "info" : "success"}>{selectedCustomer.status} customer</Badge>
          <div className="drawer-title">{selectedCustomer.name}</div>
          <p>Customer since August 2023 · Mock profile</p>
          <div className="detail-grid">
            <div><span>Email</span><strong>{selectedCustomer.email}</strong></div>
            <div><span>Phone</span><strong>{selectedCustomer.phone}</strong></div>
            <div><span>Activity</span><strong>{selectedCustomer.activity}</strong></div>
            <div><span>Lifetime value</span><strong>{selectedCustomer.value}</strong></div>
          </div>
          <div className="subheading">Recent activity</div>
          <ActivityList
            items={[
              { title: "Booking status updated", detail: "Mendoza–Reyes Wedding · 12 min ago" },
              { title: "Quotation approved", detail: "Q-2048 · June 8, 2025" },
              { title: "Message received", detail: "Conversation with Amina Santos" },
            ]}
          />
        </Drawer>
      )}
    </div>
  )
}
