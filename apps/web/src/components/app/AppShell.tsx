import { useMemo, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import {
  Avatar,
  Badge,
  Icon,
  WorkspaceLayout,
} from "@event-management/ui"

import type { EditablePackage } from "./data"
import type { NavKey } from "./types"
import { firstName, initialsFromName } from "../../lib/name"
import { BookingsPage } from "./pages/BookingsPage"
import { CalendarPage } from "./pages/CalendarPage"
import { CustomersPage } from "./pages/CustomersPage"
import { GenericPage } from "./pages/GenericPage"
import { InventoryPage } from "./pages/InventoryPage"
import { OperationsPage } from "./pages/OperationsPage"
import { Overview } from "./pages/Overview"
import { PackagesPage } from "./pages/PackagesPage"
import { ReportsPage } from "./pages/ReportsPage"
import { Sidebar } from "./Sidebar"

export function AppShell({
  onPublic,
  profile,
  onSignOut,
  packageRows,
  setPackageRows,
}: {
  onPublic: () => void
  profile: { displayName: string | null; email: string }
  onSignOut: () => void
  packageRows: EditablePackage[]
  setPackageRows: Dispatch<SetStateAction<EditablePackage[]>>
}) {
  const name = profile.displayName ?? profile.email
  const [active, setActive] = useState<NavKey>("Overview")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState(false)

  const body = useMemo(() => {
    if (active === "Overview")
      return <Overview firstName={firstName(name)} onNavigate={setActive} />
    if (active === "Bookings") return <BookingsPage />
    if (active === "Customers") return <CustomersPage />
    if (active === "Calendar") return <CalendarPage />
    if (active === "Packages")
      return (
        <PackagesPage
          packageRows={packageRows}
          setPackageRows={setPackageRows}
        />
      )
    if (active === "Inventory") return <InventoryPage />
    if (active === "Operations") return <OperationsPage />
    if (active === "Reports") return <ReportsPage />
    return <GenericPage page={active} />
  }, [active, name, packageRows, setPackageRows])

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <Sidebar
            name={name}
            active={active}
            onNavigate={setActive}
            collapsed={!sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onSignOut={onSignOut}
          />
          {sidebarOpen && (
            <button
              className="sidebar-scrim"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            ></button>
          )}
        </>
      }
      header={
        <header className="app-header">
          <button
            className="icon-button app-menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="global-search">
            <Icon name="search" />
            <input placeholder="Search events, customers, or bookings" />
            <span>⌘ K</span>
          </div>
          <div className="app-header-actions">
            <button className="back-site" onClick={onPublic}>
              Customer site
            </button>
            <Badge tone="cream">Owner workspace</Badge>
            <button
              className="notification-button"
              onClick={() => setNotifications(!notifications)}
            >
              <Icon name="bell" />
              <b>3</b>
            </button>
            <Avatar initials={initialsFromName(name)} />
            <button className="back-site" onClick={onSignOut}>
              Sign out
            </button>
          </div>
          {notifications && (
            <div className="notification-popover">
              <div className="panel-head">
                <div className="panel-title">Notifications</div>
                <button>Mark all read</button>
              </div>
              <button>
                <i></i>
                <span>
                  <strong>Quotation approved</strong>
                  <small>Elena Mendoza approved quotation Q-2048.</small>
                  <em>8 min ago</em>
                </span>
              </button>
              <button>
                <i></i>
                <span>
                  <strong>Schedule conflict</strong>
                  <small>Two staff assignments overlap on June 24.</small>
                  <em>34 min ago</em>
                </span>
              </button>
              <button>
                <span>
                  <strong>Inventory returned</strong>
                  <small>Garden Social equipment return completed.</small>
                  <em>2 hr ago</em>
                </span>
              </button>
              <a>View notification center</a>
            </div>
          )}
        </header>
      }
    >
      {body}
    </WorkspaceLayout>
  )
}
