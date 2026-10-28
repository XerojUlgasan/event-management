import { useEffect, useMemo, useRef, useState } from "react"
import {
  Avatar,
  Icon,
  Panel,
  WorkspaceLayout,
} from "@event-management/ui"

import type { NavKey } from "./types"
import { firstName, initialsFromName } from "../../lib/name"
import { BookingsPage } from "./pages/BookingsPage"
import { CalendarPage } from "./pages/CalendarPage"
import { CustomersPage } from "./pages/CustomersPage"
import { GenericPage } from "./pages/GenericPage"
import { InventoryPage } from "./pages/InventoryPage"
import { MessagesPage } from "./pages/MessagesPage"
import { OperationsPage } from "./pages/OperationsPage"
import { Overview } from "./pages/Overview"
import { PackagesPage } from "./pages/PackagesPage"
import { ReportsPage } from "./pages/ReportsPage"
import { StaffsPage } from "./pages/StaffsPage"
import { Sidebar } from "./Sidebar"
import { SignInMethods } from "./SignInMethods"

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
      <button
        type="button"
        ref={trigger}
        className="account-menu-trigger"
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Avatar initials={initialsFromName(name)} />
        {sidebar && <span>{name}</span>}
      </button>
      {open && (
        <div className="account-menu">
          <button type="button" onClick={() => { setOpen(false); onSettings() }}>Account settings</button>
          <button type="button" onClick={() => { setOpen(false); onSignOut() }}>Sign out</button>
        </div>
      )}
    </div>
  )
}

export function AppShell({
  profile,
  onSignOut,
}: {
  profile: { displayName: string | null; email: string }
  onSignOut: () => void
}) {
  const name = profile.displayName ?? profile.email
  const [active, setActive] = useState<NavKey>("Overview")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const body = useMemo(() => {
    if (active === "Overview")
      return <Overview firstName={firstName(name)} onNavigate={setActive} />
    if (active === "Bookings") return <BookingsPage />
    if (active === "Customers") return <CustomersPage />
    if (active === "Messages") return <MessagesPage />
    if (active === "Staffs") return <StaffsPage />
    if (active === "Calendar") return <CalendarPage />
    if (active === "Packages")
      return <PackagesPage />
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
            onNavigate={setActive}
            collapsed={!sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            accountMenu={<AccountMenu name={name} sidebar onSettings={() => {
              setActive("Administration")
              setSidebarOpen(false)
            }} onSignOut={onSignOut} />}
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
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="app-header-actions">
            <AccountMenu name={name} onSettings={() => setActive("Administration")} onSignOut={onSignOut} />
          </div>
        </header>
      }
    >
      {active !== "Packages" && active !== "Administration" && active !== "Messages" && <p className="demo-note" role="note">Demo preview · Changes on this screen are not submitted.</p>}
      {body}
    </WorkspaceLayout>
  )
}
