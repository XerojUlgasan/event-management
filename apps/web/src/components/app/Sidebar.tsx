import { Avatar, Brand, Icon } from "@event-management/ui"

import { roleNav } from "./data"
import type { NavKey, Role } from "./types"

export function Sidebar({
  role,
  active,
  onNavigate,
  collapsed,
  onClose,
}: {
  role: Role
  active: NavKey
  onNavigate: (key: NavKey) => void
  collapsed: boolean
  onClose: () => void
}) {
  const iconFor: Record<NavKey, string> = {
    Overview: "grid",
    Bookings: "clipboard",
    Customers: "users",
    Calendar: "calendar",
    Packages: "box",
    Inventory: "box",
    Operations: "clipboard",
    Team: "users",
    Reports: "chart",
    Administration: "settings",
  }
  return (
    <aside className={`sidebar ${collapsed ? "" : "sidebar-open"}`}>
      <div className="sidebar-top">
        <Brand light />
        <button className="sidebar-close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="workspace-label">Workspace</div>
      <nav className="side-nav">
        {(roleNav[role] ?? roleNav.Administrator ?? []).map((item) => (
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
      <div className="side-help">
        <div className="help-icon">?</div>
        <strong>Need help?</strong>
        <span>View the team guide or contact support.</span>
        <button>Open help center</button>
      </div>
      <div className="sidebar-user">
        <Avatar initials="MA" />
        <div>
          <strong>Marin Alvarez</strong>
          <span>{role === "Administrator" ? "Owner" : role}</span>
        </div>
        <Icon name="chevron" size={16} />
      </div>
    </aside>
  )
}
