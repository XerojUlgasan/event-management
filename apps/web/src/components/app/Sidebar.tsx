import { Avatar, Brand, Icon } from "@event-management/ui"

import { adminNav } from "./data"
import { initialsFromName } from "../../lib/name"
import type { NavKey } from "./types"

export function Sidebar({
  name,
  active,
  onNavigate,
  collapsed,
  onClose,
  onSignOut,
}: {
  name: string
  active: NavKey
  onNavigate: (key: NavKey) => void
  collapsed: boolean
  onClose: () => void
  onSignOut: () => void
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
      <div className="side-help">
        <div className="help-icon">?</div>
        <strong>Need help?</strong>
        <span>View the team guide or contact support.</span>
        <button>Open help center</button>
      </div>
      <div className="sidebar-user">
        <Avatar initials={initialsFromName(name)} />
        <div>
          <strong>{name}</strong>
          <span>Owner</span>
        </div>
        <button className="sidebar-signout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
