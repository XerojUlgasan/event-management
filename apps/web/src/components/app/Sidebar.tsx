import type { ReactNode } from "react"
import { Brand, Icon } from "@event-management/ui"

import { adminNav } from "./data"
import type { NavKey } from "./types"

export function Sidebar({
  active,
  onNavigate,
  collapsed,
  onClose,
  accountMenu,
}: {
  active: NavKey
  onNavigate: (key: NavKey) => void
  collapsed: boolean
  onClose: () => void
  accountMenu: ReactNode
}) {
  const iconFor: Record<NavKey, string> = {
    Overview: "grid",
    Bookings: "clipboard",
    Messages: "message",
    StaffCustomers: "users",
    Calendar: "calendar",
    Packages: "box",
    Services: "spark",
    Venues: "location",
    Inventory: "box",
    Operations: "clipboard",
    Reports: "chart",
    Administration: "settings",
  }
  const labelFor: Partial<Record<NavKey, string>> = {
    StaffCustomers: "Staff & Customers",
  }
  return (
    <aside className={`sidebar ${collapsed ? "" : "sidebar-open"}`}>
      <div className="sidebar-top">
        <Brand light />
        <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
          <Icon name="close" />
        </button>
      </div>
      <div className="workspace-label">Workspace</div>
      <nav className="side-nav">
        {adminNav.map((item) => (
          <button
            key={item}
            className={active === item ? "active" : ""}
            onClick={() => {
              onNavigate(item)
              onClose()
            }}
          >
            {item === "Venues" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            ) : <Icon name={iconFor[item]} />}
            <span>{labelFor[item] ?? item}</span>
            {item === "Operations" && <b>3</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-user">{accountMenu}</div>
    </aside>
  )
}
