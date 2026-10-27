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
  Tabs,
  Toast,
} from "@event-management/ui"

export function InventoryPage() {
  const [tab, setTab] = useState<"Inventory" | "Allocations" | "Dispatches">(
    "Inventory",
  )
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [allocationOpen, setAllocationOpen] = useState(false)
  const [toast, setToast] = useState("")

  const inventory = [
    {
      name: "Ivory linen napkins",
      sku: "LIN-NAP-IVY",
      category: "Table linens",
      available: 36,
      total: 320,
      reserved: 248,
      status: "Low stock",
      event: "Northstar Dinner · 180 units",
    },
    {
      name: "Chafing dish sets",
      sku: "EQP-CHD-008",
      category: "Service equipment",
      available: 42,
      total: 64,
      reserved: 18,
      status: "Available",
      event: "Mendoza Wedding · 12 sets",
    },
    {
      name: "Portable warming cabinets",
      sku: "EQP-WRM-003",
      category: "Kitchen equipment",
      available: 0,
      total: 8,
      reserved: 4,
      status: "Fully allocated",
      event: "Northstar Dinner · 4 units",
    },
    {
      name: "Stemmed water glasses",
      sku: "GLS-WTR-012",
      category: "Glassware",
      available: 320,
      total: 600,
      reserved: 240,
      status: "Available",
      event: "Mendoza Wedding · 200 units",
    },
    {
      name: "Service carts",
      sku: "EQP-CRT-005",
      category: "Service equipment",
      available: 11,
      total: 16,
      reserved: 3,
      status: "Damaged item",
      event: "Arc & Co. Launch · 2 units",
    },
    {
      name: "Compostable dinner plates",
      sku: "CON-PLT-010",
      category: "Consumables",
      available: 840,
      total: 1200,
      reserved: 240,
      status: "Available",
      event: "Harlow Birthday · 80 units",
    },
  ]

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2400)
  }

  return (
    <div className="content-stack inventory-page">
      <PageHeader
        title="Inventory & resources"
        description="Track stock, equipment condition, event allocation, dispatch, and returns."
        actions={
          <div className="welcome-actions">
            <Button variant="secondary">Import inventory</Button>
            <Button icon="box">Add item</Button>
          </div>
        }
      />

      <div className="stats-grid">
        <StatCard label="Inventory value" value="₱184k" detail="1,284 tracked items" />
        <StatCard label="Currently reserved" value="248" detail="Across 9 upcoming events" />
        <StatCard label="Low stock" value="7" detail="3 require action today" tone="attention" />
        <StatCard label="Utilization" value="74%" change="+6.2%" detail="this quarter" />
      </div>

      <Tabs
        active={tab}
        onChange={(value) => setTab(value as typeof tab)}
        items={[
          { value: "Inventory", label: "Inventory", count: 1284 },
          { value: "Allocations", label: "Allocations", count: 42 },
          { value: "Dispatches", label: "Dispatches", count: 16 },
        ]}
      />

      {tab === "Inventory" && (
        <Panel className="inventory-panel">
          <div className="table-tools">
            <SearchField placeholder="Search item, SKU, or category" />
            <select><option>All categories</option><option>Equipment</option><option>Linens</option><option>Consumables</option><option>Glassware</option></select>
            <select><option>All availability</option><option>Available</option><option>Reserved</option><option>Unavailable</option></select>
            <select><option>All conditions</option><option>Good</option><option>Damaged</option><option>Maintenance</option></select>
          </div>
          <div className="inventory-table">
            <div className="inventory-row inventory-header">
              <span>Item</span><span>Stock</span><span>Reserved</span><span>Next allocation</span><span>Status</span><span></span>
            </div>
            {inventory.map((item) => (
              <button
                className="inventory-row"
                key={item.sku}
                onClick={() => setSelectedItem(item.name)}
              >
                <span>
                  <i className="inventory-item-icon"><Icon name="box" /></i>
                  <span><strong>{item.name}</strong><small>{item.sku} · {item.category}</small></span>
                </span>
                <span>
                  <strong>{item.available} / {item.total}</strong>
                  <i className="stock-meter"><b className={`stock-${item.status === "Low stock" ? "low" : item.status === "Fully allocated" ? "none" : "good"}`}></b></i>
                </span>
                <span>{item.reserved}</span>
                <span><strong>{item.event.split(" · ")[0]}</strong><small>{item.event.split(" · ")[1]}</small></span>
                <span>
                  <Badge
                    tone={
                      item.status === "Available"
                        ? "success"
                        : item.status === "Low stock" ||
                            item.status === "Damaged item"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {item.status}
                  </Badge>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </div>
          <div className="pagination">
            <span>Showing 6 of 1,284 inventory items</span>
            <div><button>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div>
          </div>
        </Panel>
      )}

      {tab === "Allocations" && (
        <div className="allocation-layout">
          <Panel
            className="allocation-events"
            title="Upcoming event allocations"
            description="Next 14 days"
            action={<Button variant="secondary" onClick={() => setAllocationOpen(true)}>New allocation</Button>}
          >
            {[
              ["Mendoza–Reyes Wedding", "Jun 22 · The Glass Garden", "32 / 34 ready", "94%", "success"],
              ["Northstar Annual Dinner", "Jun 24 · Orchid Hall", "28 / 32 ready", "88%", "warning"],
              ["Harlow Garden Birthday", "Jun 27 · Harlow Residence", "14 / 18 ready", "78%", "warning"],
              ["Arc & Co. Product Launch", "Jun 29 · Foundry Loft", "8 / 24 ready", "33%", "danger"],
            ].map((row) => (
              <button key={row[0]}>
                <span className="allocation-date"><Icon name="calendar" /></span>
                <span><strong>{row[0]}</strong><small>{row[1]}</small></span>
                <span className="allocation-progress">
                  <span><small>{row[2]}</small><strong>{row[3]}</strong></span>
                  <i><b className={`allocation-${row[4]}`}></b></i>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </Panel>
          <aside className="allocation-side">
            <Panel className="allocation-warning">
              <span className="attention-icon danger"><Icon name="alert" /></span>
              <div className="panel-title">Double allocation prevented</div>
              <p>
                4 warming cabinets requested for Arc & Co. are already reserved
                for Northstar Dinner.
              </p>
              <button className="inline-link">Review alternatives <Icon name="arrow" size={14} /></button>
            </Panel>
            <Panel
              title="High utilization"
              action={<Badge tone="warning">3 categories</Badge>}
            >
              <div className="utilization-list">
                <span><span><strong>Warming equipment</strong><small>June 21–25</small></span><b>100%</b></span>
                <span><span><strong>Ivory table linens</strong><small>June 22–24</small></span><b>92%</b></span>
                <span><span><strong>Service vehicles</strong><small>June 24</small></span><b>80%</b></span>
              </div>
            </Panel>
          </aside>
        </div>
      )}

      {tab === "Dispatches" && (
        <Panel
          className="dispatch-panel"
          headClassName="dispatch-head"
          title="Dispatch & return board"
          description="Track items leaving and returning to the warehouse"
          action={<div className="legend"><span><i className="on-time"></i>On schedule</span><span><i className="delayed"></i>Attention</span></div>}
        >
          <div className="dispatch-columns">
            {[
              {
                title: "Ready for dispatch",
                count: 4,
                items: [
                  ["Mendoza–Reyes Wedding", "Jun 21 · 10:00 AM", "34 item groups"],
                  ["Northstar Dinner", "Jun 23 · 12:30 PM", "32 item groups"],
                ],
              },
              {
                title: "Dispatched",
                count: 3,
                items: [
                  ["Garden Social", "Vehicle CL-04", "ETA 2:10 PM"],
                  ["Reed Graduation", "Vehicle CL-02", "Delivered 11:42 AM"],
                ],
              },
              {
                title: "Awaiting return",
                count: 2,
                items: [
                  ["Bennett Anniversary", "Due today · 5:00 PM", "2 items pending"],
                  ["Private Chef Dinner", "Overdue by 1 day", "1 service kit"],
                ],
              },
              {
                title: "Returned",
                count: 7,
                items: [
                  ["Oak & Ivy Reception", "Checked 9:15 AM", "All items returned"],
                  ["Carter Birthday", "Checked yesterday", "1 damaged item"],
                ],
              },
            ].map((column, columnIndex) => (
              <div className="dispatch-column" key={column.title}>
                <div><strong>{column.title}</strong><span>{column.count}</span></div>
                {column.items.map((item, index) => (
                  <button key={item[0]}>
                    <Badge tone={columnIndex === 2 && index === 1 ? "danger" : columnIndex === 3 ? "success" : "info"}>
                      {columnIndex === 0 ? "Packed" : columnIndex === 1 ? "In transit" : columnIndex === 2 ? "Return due" : "Checked"}
                    </Badge>
                    <strong>{item[0]}</strong>
                    <span>{item[1]}</span>
                    <small>{item[2]}</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {selectedItem && (
        <Drawer onClose={() => setSelectedItem(null)} className="inventory-drawer">
            <Badge tone={selectedItem === "Ivory linen napkins" ? "danger" : "success"}>
              {selectedItem === "Ivory linen napkins" ? "Low stock" : "Available"}
            </Badge>
            <div className="drawer-title">{selectedItem}</div>
            <p>LIN-NAP-IVY · Table linens</p>
            <div className="inventory-balance">
              <div><span>Available</span><strong>36</strong></div>
              <div><span>Reserved</span><strong>248</strong></div>
              <div><span>In laundry</span><strong>36</strong></div>
              <div><span>Total</span><strong>320</strong></div>
            </div>
            <div className="subheading">Upcoming allocations</div>
            <div className="item-allocation-list">
              <span><i>22</i><span><strong>Mendoza–Reyes Wedding</strong><small>180 units · Jun 22</small></span><Badge tone="success">Packed</Badge></span>
              <span><i>24</i><span><strong>Northstar Annual Dinner</strong><small>120 units · Jun 24</small></span><Badge tone="warning">Preparing</Badge></span>
            </div>
            <div className="stock-alert-detail">
              <Icon name="alert" />
              <span><strong>Reorder recommended</strong><small>At current reservations, stock will fall 24 units below the preferred buffer.</small></span>
            </div>
            <div className="subheading">Recent activity</div>
            <ActivityList
              items={[
                { title: "36 units returned from laundry", detail: "Today · 9:22 AM by Jamie Cole" },
                { title: "120 units reserved", detail: "Yesterday · Northstar Annual Dinner" },
                { title: "180 units packed", detail: "June 14 · Mendoza–Reyes Wedding" },
              ]}
            />
            <div className="drawer-actions">
              <Button variant="secondary">Adjust stock</Button>
              <Button onClick={() => { setSelectedItem(null); setAllocationOpen(true) }}>Allocate item</Button>
            </div>
        </Drawer>
      )}

      {allocationOpen && (
        <Dialog
          onClose={() => setAllocationOpen(false)}
          className="allocation-modal"
          eyebrow="Resource allocation"
          title="Allocate inventory"
          intro="Availability is checked against existing event reservations and dispatch windows."
          actions={
            <>
              <Button variant="secondary" onClick={() => setAllocationOpen(false)}>Cancel</Button>
              <Button onClick={() => { setAllocationOpen(false); notify("24 items allocated to Northstar Annual Dinner") }}>Confirm allocation</Button>
            </>
          }
        >
          <div className="form-grid">
            <FormField className="full" label="Event"><select defaultValue="Northstar Annual Dinner"><option>Northstar Annual Dinner</option><option>Mendoza–Reyes Wedding</option><option>Harlow Garden Birthday</option></select></FormField>
            <FormField label="Inventory item"><select defaultValue="Ivory linen napkins"><option>Ivory linen napkins</option><option>Chafing dish sets</option><option>Stemmed water glasses</option></select></FormField>
            <FormField label="Quantity"><input type="number" defaultValue="24" min="1" /></FormField>
            <FormField label="Dispatch date"><input type="date" defaultValue="2025-06-23" /></FormField>
            <FormField label="Return date"><input type="date" defaultValue="2025-06-25" /></FormField>
          </div>
          <div className="availability-result">
            <Icon name="check" />
            <span><strong>24 units are available</strong><small>36 available during the selected reservation window.</small></span>
          </div>
        </Dialog>
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  )
}

