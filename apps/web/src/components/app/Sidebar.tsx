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
    Customers: "users",
    Staffs: "users",
    Calendar: "calendar",
    Packages: "box",
    Inventory: "box",
    Operations: "clipboard",
    Reports: "chart",
    Administration: "settings",
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
            <Icon name={iconFor[item]} />
            <span>{item}</span>
            {item === "Operations" && <b>3</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-user">{accountMenu}</div>
    </aside>
  )
}
