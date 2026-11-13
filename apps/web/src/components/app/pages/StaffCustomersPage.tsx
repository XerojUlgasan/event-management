import { useEffect, useRef, useState } from "react"
import {
  Button,
  ActivityList,
  Avatar,
  Drawer,
  Icon,
  PageHeader,
  Panel,
  Pagination,
  SearchField,
  StatCard,
  Tabs,
  useNotifications,
} from "@event-management/ui"
import { usePagination } from "../../../lib/use-pagination"
import { getAdminUsers, type AdminUser, type DirectoryStats } from "../../../lib/data/users"

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
  const { notifyError } = useNotifications()
  const [tab, setTab] = useState("Staff")
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [loadRevision, setLoadRevision] = useState(0)
  const [stats, setStats] = useState<DirectoryStats>({ staffTotal: 0, customerTotal: 0, staffRoles: 0, staffJoined: 0, customerJoined: 0 })
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState("")
  const [staff, setStaff] = useState<AdminUser[]>([])
  const [customers, setCustomers] = useState<AdminUser[]>([])
  const [staffQuery, setStaffQuery] = useState("")
  const [customerQuery, setCustomerQuery] = useState("")
  const [selectedStaff, setSelectedStaff] = useState<AdminUser | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<AdminUser | null>(null)

  const group = tab === "Staff" ? "staff" : "customers"
  const search = group === "staff" ? staffQuery : customerQuery
  const scope = JSON.stringify([group, search.trim().toLowerCase()])
  const pagination = usePagination(scope)
  const requestKey = JSON.stringify([scope, pagination.cursor])
  const currentScope = useRef(requestKey)
  currentScope.current = requestKey
  useEffect(() => {
    let active = true
    setLoadState("loading")
    getAdminUsers(group, search, pagination.cursor ?? undefined)
      .then(({ staff, customers, stats, nextCursor }) => {
        if (!active || currentScope.current !== requestKey) return
        setStaff(staff)
        setCustomers(customers)
        setStats(stats)
        setNextCursor(nextCursor)
        setLoadedKey(requestKey)
        setLoadState("ready")
      })
      .catch(() => { if (active && currentScope.current === requestKey) { setLoadState("error"); notifyError("Unable to load staff and customers.") } })
    return () => { active = false }
  }, [group, search, requestKey, pagination.cursor, notifyError, loadRevision])

  const pageReady = loadState === "ready" && loadedKey === requestKey
  const filteredStaff = staff
  const filteredCustomers = customers

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
          <Button variant="secondary" onClick={() => { setLoadState("loading"); setLoadRevision(value => value + 1) }}>Try again</Button>
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
          { value: "Staff", label: "Staff", count: stats.staffTotal },
          { value: "Customers", label: "Customers", count: stats.customerTotal },
        ]}
      />
      {!pageReady && <p role="status">Loading users…</p>}
      {tab === "Staff" ? (
        <>
          <div className="stats-grid three">
            <StatCard label="Total staff" value={String(stats.staffTotal)} detail="In the directory" />
            <StatCard
              label="By role"
              value={String(stats.staffRoles)}
              detail="Distinct job roles"
            />
            <StatCard
              label="Joined this month"
              value={String(stats.staffJoined)}
              detail="New this month"
            />
          </div>
          <Panel className="customer-admin-panel">
            <div className="table-tools">
              <SearchField
                value={staffQuery}
                onChange={(event) => setStaffQuery(event.target.value.slice(0, 200))}
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
              {(pageReady ? filteredStaff : []).map((person) => (
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
              {pageReady && filteredStaff.length === 0 && (
                <div className="empty-state">
                  <Icon name="search" size={28} />
                  <strong>No matching staff</strong>
                  <span>Try a different search term.</span>
                </div>
              )}
            </div>
            <Pagination page={pagination.page} hasNextPage={pageReady && !!nextCursor} onPrevious={pagination.previous} onNext={() => nextCursor && pagination.next(nextCursor)} pending={!pageReady} />
          </Panel>
        </>
      ) : (
        <>
          <div className="stats-grid three">
            <StatCard label="Total customers" value={String(stats.customerTotal)} detail="In the directory" />
            <StatCard
              label="Joined this month"
              value={String(stats.customerJoined)}
              detail="New this month"
            />
            <StatCard label="Active inquiries" value="—" detail="Coming soon" />
          </div>
          <Panel className="customer-admin-panel">
            <div className="table-tools">
              <SearchField
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value.slice(0, 200))}
                placeholder="Search customer name or email"
              />
            </div>
            <div className="customer-admin-table">
              <div className="customer-admin-row header">
                <span>Customer</span>
                <span>Email</span>
                <span></span>
              </div>
              {(pageReady ? filteredCustomers : []).map((customer) => (
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
              {pageReady && filteredCustomers.length === 0 && (
                <div className="empty-state">
                  <Icon name="search" size={28} />
                  <strong>No matching customers</strong>
                  <span>Try a different search term.</span>
                </div>
              )}
            </div>
            <Pagination page={pagination.page} hasNextPage={pageReady && !!nextCursor} onPrevious={pagination.previous} onNext={() => nextCursor && pagination.next(nextCursor)} pending={!pageReady} />
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
