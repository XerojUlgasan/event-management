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
  Tabs,
  Toast,
} from "@event-management/ui"

import { usePackages } from "../AppContext"
import { photos } from "../data"
import type { EditablePackage } from "../data"

export function PackagesPage() {
  const { packageRows, removePackage, savePackage } = usePackages()
  const [tab, setTab] = useState<"Packages" | "Quotations" | "Menus">("Packages")
  const [quotation, setQuotation] = useState(false)
  const [toast, setToast] = useState("")
  const [editingPackage, setEditingPackage] = useState<EditablePackage | null>(
    null,
  )
  const [editingPackageOriginal, setEditingPackageOriginal] = useState<
    string | null
  >(null)
  const emptyPackage: EditablePackage = {
    name: "",
    kind: "Social event",
    price: "From $0 / guest",
    guests: "20–100 guests",
    description: "",
    image: photos.dinner,
    tag: "New",
    inclusions: "",
    status: "Draft",
  }
  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2600)
  }

  return (
    <div className="content-stack packages-page">
      <PageHeader
        title="Packages & quotations"
        description="Manage offers, menus, pricing, add-ons, and customer quotations."
        actions={
          <Button
            icon="box"
            onClick={() => {
              if (tab === "Packages") {
                setEditingPackageOriginal(null)
                setEditingPackage(emptyPackage)
              }
            }}
          >
            {tab === "Packages"
              ? "Create package"
              : tab === "Quotations"
                ? "Create quotation"
                : "Add menu item"}
          </Button>
        }
      />
      <Tabs
        className="package-tabs"
        active={tab}
        onChange={(value) => setTab(value as typeof tab)}
        items={[
          { value: "Packages", label: "Packages", count: 11 },
          { value: "Quotations", label: "Quotations", count: 18 },
          { value: "Menus", label: "Menus", count: 126 },
        ]}
      />

      {tab === "Packages" && (
        <>
          <div className="package-admin-summary">
            <div>
              <span>Published</span><strong>8</strong><small>Visible to customers</small>
            </div>
            <div>
              <span>Drafts</span><strong>3</strong><small>1 needs review</small>
            </div>
            <div>
              <span>Average value</span><strong>$62</strong><small>Per guest</small>
            </div>
            <div>
              <span>Most requested</span><strong>Signature</strong><small>42% of inquiries</small>
            </div>
          </div>
          <div className="table-tools package-tools">
            <SearchField placeholder="Search packages" />
            <select><option>All statuses</option><option>Published</option><option>Draft</option><option>Archived</option></select>
            <select><option>All event types</option><option>Wedding</option><option>Corporate</option><option>Social</option></select>
            <Button variant="secondary">More filters</Button>
          </div>
          <div className="admin-package-grid">
            {packageRows.map((item, index) => (
              <article className="admin-package-card" key={item.name}>
                <div className="admin-package-image">
                  <img src={item.image} alt="" />
                  <Badge tone={item.status === "Draft" ? "warning" : "success"}>
                    {item.status}
                  </Badge>
                  <button
                    aria-label={`Delete ${item.name}`}
                    onClick={() => {
                      removePackage(item.name)
                      showToast(`${item.name} deleted`)
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="admin-package-body">
                  <span className="package-kind">{item.kind}</span>
                  <div className="card-title">{item.name}</div>
                  <p>{item.description}</p>
                  <div className="admin-package-data">
                    <span><small>Price</small><strong>{item.price.replace("From ", "")}</strong></span>
                    <span><small>Capacity</small><strong>{item.guests}</strong></span>
                    <span><small>Menu items</small><strong>{index === 0 ? 24 : index === 1 ? 18 : 16}</strong></span>
                  </div>
                  <div className="admin-package-actions">
                    <Button variant="secondary">Preview</Button>
                    <Button
                      variant={item.status === "Draft" ? "primary" : "secondary"}
                      onClick={() => {
                        setEditingPackageOriginal(item.name)
                        setEditingPackage(item)
                      }}
                    >
                      Edit package
                    </Button>
                  </div>
                </div>
              </article>
            ))}
            <button
              className="new-package-card"
              onClick={() => {
                setEditingPackageOriginal(null)
                setEditingPackage(emptyPackage)
              }}
            >
              <span><Icon name="box" /></span>
              <strong>Create a new package</strong>
              <small>Build from scratch or duplicate an existing offer.</small>
            </button>
          </div>
        </>
      )}

      {tab === "Quotations" && (
        <Panel className="quotation-panel">
          <div className="table-tools">
            <SearchField placeholder="Search quotation or customer" />
            <select><option>All statuses</option><option>Draft</option><option>Sent</option><option>Approved</option><option>Expiring</option></select>
            <select><option>All managers</option><option>Amina Santos</option><option>Jon Bell</option></select>
          </div>
          <div className="quotation-table">
            <div className="quotation-row quotation-header">
              <span>Quotation</span><span>Event</span><span>Total</span><span>Valid until</span><span>Status</span><span></span>
            </div>
            {[
              ["Q-2058", "Sofia Laurent", "Arc & Co. Product Launch", "$8,740", "Jun 20", "Draft"],
              ["Q-2055", "Mei Harlow", "Harlow Garden Birthday", "$4,280", "Jun 17", "Expiring"],
              ["Q-2051", "Noah Williams", "Northstar Annual Dinner", "$18,920", "Jun 24", "Approved"],
              ["Q-2048", "Elena Mendoza", "Mendoza–Reyes Wedding", "$14,860", "Jun 18", "Approved"],
              ["Q-2043", "Lena Park", "Park Family Anniversary", "$6,420", "Jun 14", "Revision requested"],
            ].map((row) => (
              <button
                className="quotation-row"
                key={row[0]}
                onClick={() => setQuotation(true)}
              >
                <span><strong>{row[0]}</strong><small>{row[1]}</small></span>
                <span><strong>{row[2]}</strong><small>Created Jun 10, 2025</small></span>
                <span><strong>{row[3]}</strong></span>
                <span>{row[4]}</span>
                <span>
                  <Badge
                    tone={
                      row[5] === "Approved"
                        ? "success"
                        : row[5] === "Expiring"
                          ? "danger"
                          : row[5] === "Draft"
                            ? "neutral"
                            : "warning"
                    }
                  >
                    {row[5]}
                  </Badge>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </div>
          <div className="pagination">
            <span>Showing 5 of 18 quotations</span>
            <div><button>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div>
          </div>
        </Panel>
      )}

      {tab === "Menus" && (
        <div className="menu-management">
          <aside className="panel menu-categories">
            <div className="panel-title">Menu categories</div>
            {["All items", "Canapés", "Starters", "Main courses", "Sides", "Desserts", "Beverages"].map((item, index) => (
              <button className={index === 0 ? "active" : ""} key={item}>
                <span>{item}</span><small>{[126, 18, 16, 32, 21, 24, 15][index]}</small>
              </button>
            ))}
          </aside>
          <Panel className="menu-items-panel">
            <div className="table-tools">
              <SearchField placeholder="Search menu items" />
              <select><option>All dietary types</option><option>Vegetarian</option><option>Vegan</option><option>Gluten-free</option></select>
              <Button variant="secondary">Filter</Button>
            </div>
            <div className="menu-item-list">
              {[
                ["Herb-crusted salmon", "Main course", "$24", ["Gluten-free"]],
                ["Wild mushroom risotto", "Main course", "$18", ["Vegetarian", "Gluten-free"]],
                ["Slow-braised beef short rib", "Main course", "$28", []],
                ["Citrus garden salad", "Starter", "$12", ["Vegan", "Gluten-free"]],
                ["Vanilla bean panna cotta", "Dessert", "$11", ["Vegetarian"]],
              ].map((item) => (
                <button key={item[0] as string}>
                  <span className="menu-thumb"><Icon name="box" /></span>
                  <span><strong>{item[0] as string}</strong><small>{item[1] as string}</small></span>
                  <span className="dietary-tags">
                    {(item[3] as string[]).map((tag) => <Badge tone="neutral" key={tag}>{tag}</Badge>)}
                  </span>
                  <strong>{item[2] as string}</strong>
                  <Badge tone="success">Available</Badge>
                  <Icon name="chevron" size={14} />
                </button>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {quotation && (
        <Drawer
          onClose={() => setQuotation(false)}
          className="quotation-drawer"
        >
            <div className="drawer-label">QUOTATION Q-2055</div>
            <div className="drawer-title">Harlow Garden Birthday</div>
            <p>Prepared for Mei Harlow · Valid until June 17, 2025</p>
            <div className="quotation-warning">
              <Icon name="alert" />
              <span><strong>Expires tomorrow</strong><small>Send a reminder or extend the validity date.</small></span>
            </div>
            <div className="subheading">Quotation items</div>
            <div className="drawer-quote-lines">
              <span><span><strong>Garden Social</strong><small>65 guests × $48</small></span><strong>$3,120</strong></span>
              <span><span><strong>Garden beverage station</strong><small>1 package</small></span><strong>$580</strong></span>
              <span><span><strong>Canopy & ambient lighting</strong><small>Optional add-on</small></span><strong>$420</strong></span>
              <span><span><strong>Service extension</strong><small>2 additional hours</small></span><strong>$160</strong></span>
            </div>
            <div className="drawer-quote-total">
              <span>Total</span><strong>$4,280.00</strong>
            </div>
            <div className="subheading">History</div>
            <ActivityList
              items={[
                { title: "Quotation sent", detail: "June 10 · 2:42 PM by Amina Santos" },
                { title: "Customer viewed", detail: "June 11 · 9:18 AM" },
                { title: "Reminder scheduled", detail: "June 16 · 10:00 AM" },
              ]}
            />
            <div className="drawer-actions quotation-actions">
              <Button variant="secondary">Extend validity</Button>
              <Button
                onClick={() => {
                  setQuotation(false)
                  showToast("Reminder sent to Mei Harlow")
                }}
              >
                Send reminder
              </Button>
            </div>
        </Drawer>
      )}
      {editingPackage && (
        <Dialog
          onClose={() => setEditingPackage(null)}
          eyebrow="Event package"
          title={
            packageRows.some((item) => item.name === editingPackage.name)
              ? "Edit package"
              : "Create package"
          }
          actions={
            <>
              <Button variant="secondary" onClick={() => setEditingPackage(null)}>Cancel</Button>
              <Button onClick={() => {
                savePackage(editingPackage, editingPackageOriginal)
                showToast(`${editingPackage.name || "Package"} saved`)
                setEditingPackage(null)
              }}>Save package</Button>
            </>
          }
        >
          <div className="form-grid">
            <FormField label="Package name"><input value={editingPackage.name} onChange={(event) => setEditingPackage({ ...editingPackage, name: event.target.value })} /></FormField>
            <FormField label="Event type"><input value={editingPackage.kind} onChange={(event) => setEditingPackage({ ...editingPackage, kind: event.target.value })} /></FormField>
            <FormField label="Price"><input value={editingPackage.price} onChange={(event) => setEditingPackage({ ...editingPackage, price: event.target.value })} /></FormField>
            <FormField label="Guest capacity"><input value={editingPackage.guests} onChange={(event) => setEditingPackage({ ...editingPackage, guests: event.target.value })} /></FormField>
            <FormField className="full" label="Description"><textarea value={editingPackage.description} onChange={(event) => setEditingPackage({ ...editingPackage, description: event.target.value })} /></FormField>
            <FormField className="full" label="Inclusions"><textarea value={editingPackage.inclusions} onChange={(event) => setEditingPackage({ ...editingPackage, inclusions: event.target.value })} /></FormField>
            <FormField className="full" label="Image URL"><input value={editingPackage.image} onChange={(event) => setEditingPackage({ ...editingPackage, image: event.target.value })} /></FormField>
            <FormField label="Status"><select value={editingPackage.status} onChange={(event) => setEditingPackage({ ...editingPackage, status: event.target.value })}><option>Draft</option><option>Published</option></select></FormField>
          </div>
        </Dialog>
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  )
}

