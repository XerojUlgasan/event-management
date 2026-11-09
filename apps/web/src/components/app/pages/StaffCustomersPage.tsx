import { useEffect, useState } from "react"
import {
  Button,
  ActivityList,
  Avatar,
  Drawer,
  Icon,
  PageHeader,
  Panel,
  SearchField,
  StatCard,
  Tabs,
} from "@event-management/ui"
import { getAdminUsers, type AdminUser } from "../../../lib/data/users"

type LoadState = "loading" | "ready" | "error"

function initials(name: string | null) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function StaffCustomersPage() {
  const [tab, setTab] = useState("Staff")
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [staff, setStaff] = useState<AdminUser[]>([])
  const [customers, setCustomers] = useState<AdminUser[]>([])
  const [staffQuery, setStaffQuery] = useState("")
  const [customerQuery, setCustomerQuery] = useState("")
  const [selectedStaff, setSelectedStaff] = useState<AdminUser | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<AdminUser | null>(null)

  useEffect(() => {
    setLoadState("loading")
    getAdminUsers()
      .then(({ staff, customers }) => {
        setStaff(staff)
        setCustomers(customers)
        setLoadState("ready")
      })
      .catch(() => setLoadState("error"))
  }, [])

  const filteredStaff = staff.filter((person) =>
    `${person.displayName ?? ""} ${person.staffRole ?? ""} ${person.email}`
      .toLowerCase()
      .includes(staffQuery.trim().toLowerCase()),
  )

  const filteredCustomers = customers.filter((person) =>
    `${person.displayName ?? ""} ${person.email}`
      .toLowerCase()
      .includes(customerQuery.trim().toLowerCase()),
  )

  if (loadState === "loading") {
    return (
      <div className="content-stack">
        <PageHeader
          title="Staff & Customers"
          description="View staff roles and customer profiles in one place."
        />
        <div className="loading-state" aria-busy="true" aria-label="Loading users">
          <Icon name="spinner" size={24} />
          <span>Loading…</span>
        </div>
      </div>
    )
  }

  if (loadState === "error") {
    return (
      <div className="content-stack">
        <PageHeader
          title="Staff & Customers"
          description="View staff roles and customer profiles in one place."
        />
        <div className="empty-state">
          <Icon name="alert" size={28} />
          <strong>Could not load users</strong>
          <span>Please check your connection and try again.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="content-stack">
      <PageHeader
        title="Staff & Customers"
        description="View staff roles and customer profiles in one place."
      />
      <Tabs
        aria-label="Directory views"
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
            <StatCard label="Total staff" value={String(staff.length)} detail="In the directory" />
            <StatCard
              label="By role"
              value={String(new Set(staff.map((p) => p.staffRole).filter(Boolean)).size)}
              detail="Distinct job roles"
            />
            <StatCard
              label="Joined this month"
              value={String(
                staff.filter((p) => {
                  const d = new Date(p.createdAt)
                  const now = new Date()
                  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
                }).length,
              )}
              detail="New this month"
            />
          </div>
          <Panel className="customer-admin-panel">
            <div className="table-tools">
              <SearchField
                value={staffQuery}
                onChange={(event) => setStaffQuery(event.target.value)}
                placeholder="Search staff name, role, or email"
              />
            </div>
            <div className="customer-admin-table">
              <div className="staff-admin-row header">
                <span>Staff member</span>
                <span>Role</span>
                <span>Phone</span>
                <span></span>
              </div>
              {filteredStaff.map((person) => (
                <Button variant="plain"
                  className="staff-admin-row"
                  key={person.id}
                  onClick={() => setSelectedStaff(person)}
                >
                  <span>
                    <span className="directory-avatar" aria-hidden="true"><Avatar initials={initials(person.displayName)} /></span>
                    <span>
                      <strong>{person.displayName ?? person.email}</strong>
                      <small>{person.email}</small>
                    </span>
                  </span>
                  <span>{person.staffRole ?? "—"}</span>
                  <span>—</span>
                  <Icon name="chevron" size={15} />
                </Button>
              ))}
              {filteredStaff.length === 0 && (
                <div className="empty-state">
                  <Icon name="search" size={28} />
                  <strong>No matching staff</strong>
                  <span>Try a different search term.</span>
                </div>
              )}
            </div>
          </Panel>
        </>
      ) : (
        <>
          <div className="stats-grid three">
            <StatCard label="Total customers" value={String(customers.length)} detail="In the directory" />
            <StatCard
              label="Joined this month"
              value={String(
                customers.filter((p) => {
                  const d = new Date(p.createdAt)
                  const now = new Date()
                  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
                }).length,
              )}
              detail="New this month"
            />
            <StatCard label="Active inquiries" value="—" detail="Coming soon" />
          </div>
          <Panel className="customer-admin-panel">
            <div className="table-tools">
              <SearchField
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                placeholder="Search customer name or email"
              />
            </div>
            <div className="customer-admin-table">
              <div className="customer-admin-row header">
                <span>Customer</span>
                <span>Email</span>
                <span></span>
              </div>
              {filteredCustomers.map((customer) => (
                <Button variant="plain"
                  className="customer-admin-row"
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <span>
                    <span className="directory-avatar" aria-hidden="true"><Avatar initials={initials(customer.displayName)} /></span>
                    <span>
                      <strong>{customer.displayName ?? customer.email}</strong>
                      <small>{customer.email}</small>
                    </span>
                  </span>
                  <span>{customer.email}</span>
                  <Icon name="chevron" size={15} />
                </Button>
              ))}
              {filteredCustomers.length === 0 && (
                <div className="empty-state">
                  <Icon name="search" size={28} />
                  <strong>No matching customers</strong>
                  <span>Try a different search term.</span>
                </div>
              )}
            </div>
          </Panel>
        </>
      )}
      {selectedStaff && (
        <Drawer title={selectedStaff.displayName ?? selectedStaff.email} onClose={() => setSelectedStaff(null)}>
          <p>{selectedStaff.staffRole ?? "Staff"}</p>
          <div className="detail-grid">
            <div><span>Email</span><strong>{selectedStaff.email}</strong></div>
            <div><span>Phone</span><strong>—</strong></div>
            <div><span>Role</span><strong>{selectedStaff.staffRole ?? "—"}</strong></div>
            <div>
              <span>Member since</span>
              <strong>{new Date(selectedStaff.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</strong>
            </div>
          </div>
        </Drawer>
      )}
      {selectedCustomer && (
        <Drawer title={selectedCustomer.displayName ?? selectedCustomer.email} onClose={() => setSelectedCustomer(null)}>
          <p>Customer</p>
          <div className="detail-grid">
            <div><span>Email</span><strong>{selectedCustomer.email}</strong></div>
            <div><span>Phone</span><strong>—</strong></div>
            <div>
              <span>Member since</span>
              <strong>{new Date(selectedCustomer.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</strong>
            </div>
          </div>
          <div className="subheading">Recent activity</div>
          <ActivityList
            items={[
              { title: "Account created", detail: new Date(selectedCustomer.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) },
            ]}
          />
        </Drawer>
      )}
    </div>
  )
}
