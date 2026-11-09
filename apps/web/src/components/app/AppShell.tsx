import { useEffect, useMemo, useRef, useState } from "react"
import {
  Button,
  Avatar,
  Icon,
  Panel,
  WorkspaceLayout,
} from "@event-management/ui"

import type { NavKey } from "./types"
import { firstName, initialsFromName } from "../../lib/utils/name"
import { BookingsPage } from "./pages/BookingsPage"
import { CalendarPage } from "./pages/CalendarPage"
import { GenericPage } from "./pages/GenericPage"
import { InventoryPage } from "./pages/InventoryPage"
import { MessagesPage } from "./pages/MessagesPage"
import { OperationsPage } from "./pages/OperationsPage"
import { Overview } from "./pages/Overview"
import { PackagesPage } from "./pages/PackagesPage"
import { VenuesPage } from "./pages/VenuesPage"
import { ServicesPanel } from "./pages/ServicesPanel"
import { ReportsPage } from "./pages/ReportsPage"
import { StaffCustomersPage } from "./pages/StaffCustomersPage"
import { Sidebar } from "./Sidebar"
import { SignInMethods } from "./SignInMethods"
import { adminPaths } from "./routes"

function AccountMenu({ name, sidebar = false, onSettings, onSignOut }: {
  name: string
  sidebar?: boolean
  onSettings: () => void
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener("pointerdown", dismiss)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", dismiss)
      document.removeEventListener("keydown", escape)
    }
  }, [open])

  return (
    <div className={`account-menu-wrap ${sidebar ? "account-menu-sidebar" : ""}`} ref={container}>
      <Button variant="plain"
        type="button"
        ref={trigger}
        className="account-menu-trigger"
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Avatar initials={initialsFromName(name)} />
        {sidebar && <span>{name}</span>}
      </Button>
      {open && (
        <div className="account-menu">
          <Button variant="plain" type="button" onClick={() => { setOpen(false); onSettings() }}>Account settings</Button>
          <Button variant="plain" type="button" onClick={() => { setOpen(false); onSignOut() }}>Sign out</Button>
        </div>
      )}
    </div>
  )
}

export function AppShell({
  profile,
  onSignOut,
  active,
}: {
  profile: { displayName: string | null; email: string }
  onSignOut: () => void
  active: NavKey
}) {
  const name = profile.displayName ?? profile.email
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const go = (key: NavKey) => { window.location.assign(adminPaths[key]) }

  const body = useMemo(() => {
    if (active === "Overview")
      return <Overview firstName={firstName(name)} onNavigate={go} />
    if (active === "Bookings") return <BookingsPage />
    if (active === "Messages") return <MessagesPage />
    if (active === "StaffCustomers") return <StaffCustomersPage />
    if (active === "Calendar") return <CalendarPage />
    if (active === "Packages")
      return <PackagesPage />
    if (active === "Services")
      return <ServicesPanel />
    if (active === "Venues") return <VenuesPage />
    if (active === "Inventory") return <InventoryPage />
    if (active === "Operations") return <OperationsPage />
    if (active === "Reports") return <ReportsPage />
    if (active === "Administration") return (
      <section className="account-settings">
        <h1 className="page-title">Account settings</h1>
        <Panel className="account-summary">
          <h2>Profile</h2>
          <dl>
            <div><dt>Name</dt><dd>{name}</dd></div>
            <div><dt>Email address</dt><dd>{profile.email}</dd></div>
          </dl>
        </Panel>
        <SignInMethods />
      </section>
    )
    return <GenericPage page={active} />
  }, [active, name, profile.email])

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <Sidebar
            active={active}
            onNavigate={go}
            collapsed={!sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            accountMenu={<AccountMenu name={name} sidebar onSettings={() => {
              go("Administration")
              setSidebarOpen(false)
            }} onSignOut={onSignOut} />}
          />
          {sidebarOpen && (
            <Button variant="plain"
              className="sidebar-scrim"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            ></Button>
          )}
        </>
      }
      header={
        <header className="app-header">
          <Button variant="plain"
            className="icon-button app-menu"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </Button>
          <div className="app-header-actions">
            <AccountMenu name={name} onSettings={() => go("Administration")} onSignOut={onSignOut} />
          </div>
        </header>
      }
    >
      {active !== "Bookings" && active !== "Packages" && active !== "Services" && active !== "Venues" && active !== "Administration" && active !== "Messages" && <p className="demo-note" role="note">Demo preview · Changes on this screen are not submitted.</p>}
      {body}
    </WorkspaceLayout>
  )
}
