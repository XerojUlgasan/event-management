import { useState } from "react"
import {
  ActivityList,
  Badge,
  Button,
  Dialog,
  Drawer,
  FormField,
  Icon,
  PageHeader,
  Panel,
  SearchField,
  StatCard,
} from "@event-management/ui"

type CustomerRecord = {
  id: number
  name: string
  email: string
  phone: string
  activity: string
  value: string
  status: string
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([
    { id: 1, name: "Elena Mendoza", email: "elena@example.com", phone: "+1 555 014 2830", activity: "2 bookings", value: "₱18,240", status: "Active" },
    { id: 2, name: "Noah Williams", email: "noah@example.com", phone: "+1 555 012 8841", activity: "3 bookings", value: "₱26,580", status: "Active" },
    { id: 3, name: "Mei Harlow", email: "mei@example.com", phone: "+1 555 019 4210", activity: "1 request", value: "₱4,280", status: "New" },
    { id: 4, name: "Sofia Laurent", email: "sofia@example.com", phone: "+1 555 017 9314", activity: "2 requests", value: "₱12,900", status: "Active" },
    { id: 5, name: "Lena Park", email: "lena@example.com", phone: "+1 555 015 1174", activity: "1 booking", value: "₱6,420", status: "Active" },
  ])
  const [selected, setSelected] = useState<CustomerRecord | null>(null)
  const [editing, setEditing] = useState<CustomerRecord | null>(null)
  const emptyCustomer: CustomerRecord = { id: 0, name: "", email: "", phone: "", activity: "No bookings", value: "₱0", status: "New" }
  return (
    <div className="content-stack">
      <PageHeader
        title="Customers"
        description="View customer profiles, event activity, and booking history."
        actions={<Button icon="users" onClick={() => setEditing(emptyCustomer)}>Add customer</Button>}
      />
      <div className="stats-grid three">
        <StatCard label="Total customers" value="284" detail="18 added this month" />
        <StatCard label="Returning customers" value="38%" detail="108 customers" />
        <StatCard label="Active inquiries" value="24" detail="7 need a response" />
      </div>
      <Panel className="customer-admin-panel">
        <div className="table-tools">
          <SearchField placeholder="Search customer name or email" />
          <select><option>All customers</option><option>Active</option><option>New</option></select>
        </div>
        <div className="customer-admin-table">
          <div className="customer-admin-row header">
            <span>Customer</span><span>Activity</span><span>Lifetime value</span><span>Status</span><span></span>
          </div>
          {customers.map((customer) => (
            <button
              className="customer-admin-row"
              key={customer.id}
              onClick={() => setSelected(customer)}
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
      {selected && (
        <Drawer onClose={() => setSelected(null)}>
          <Badge tone="success">Active customer</Badge>
            <div className="drawer-title">{selected.name}</div>
            <p>Customer since August 2023 · Mock profile</p>
            <div className="detail-grid">
              <div><span>Email</span><strong>{selected.email}</strong></div>
              <div><span>Phone</span><strong>{selected.phone}</strong></div>
              <div><span>Activity</span><strong>{selected.activity}</strong></div>
              <div><span>Lifetime value</span><strong>{selected.value}</strong></div>
            </div>
            <div className="subheading">Recent activity</div>
            <ActivityList
              items={[
                { title: "Booking status updated", detail: "Mendoza–Reyes Wedding · 12 min ago" },
                { title: "Quotation approved", detail: "Q-2048 · June 8, 2025" },
                { title: "Message received", detail: "Conversation with Amina Santos" },
              ]}
            />
            <div className="drawer-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setCustomers((items) => items.filter((item) => item.id !== selected.id))
                  setSelected(null)
                }}
              >
                Delete
              </Button>
              <Button onClick={() => { setEditing(selected); setSelected(null) }}>Edit customer</Button>
            </div>
        </Drawer>
      )}
      {editing && (
        <Dialog
          onClose={() => setEditing(null)}
          className="compact-modal"
          eyebrow="Customer record"
          title={editing.id ? "Edit customer" : "Add customer"}
          actions={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => {
                if (editing.id) {
                  setCustomers((items) => items.map((item) => item.id === editing.id ? editing : item))
                } else {
                  setCustomers((items) => [...items, { ...editing, id: Date.now() }])
                }
                setEditing(null)
              }}>Save customer</Button>
            </>
          }
        >
          <div className="form-grid">
            <FormField className="full" label="Full name"><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></FormField>
            <FormField label="Email"><input type="email" value={editing.email} onChange={(event) => setEditing({ ...editing, email: event.target.value })} /></FormField>
            <FormField label="Phone"><input value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} /></FormField>
            <FormField label="Status"><select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })}><option>New</option><option>Active</option></select></FormField>
          </div>
        </Dialog>
      )}
    </div>
  )
}

