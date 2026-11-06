import { useState, useRef, useEffect } from "react"
import { Avatar, Badge, Brand, Button, Icon } from "@event-management/ui"
import { UpcomingEventsPage } from "./UpcomingEventsPage"

import { EventChecklistPage } from "./EventChecklistPage"

type StaffTab = "events" | "checklist"

/** Detect whether this staff account has coordinator access.
 *  In production, the server controls this. Here we check staffRole
 *  for any value that signals coordinator privileges.
 */
function isCoordinator(staffRole: string | null) {
  if (!staffRole) return false
  const r = staffRole.toLowerCase()
  return r.includes("coordinator") || r.includes("head waiter")
}

export function StaffWorkspaceShell({
  profile,
  onSignOut,
}: {
  profile: {
    displayName: string | null
    email: string
    staffRole: string | null
  }
  onSignOut: () => void
}) {
  const coordinator = isCoordinator(profile.staffRole)
  const [tab, setTab] = useState<StaffTab>("events")
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  // Close account menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    if (accountOpen) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [accountOpen])

  const name = profile.displayName ?? profile.email
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")

  return (
    <div className="sw-shell">
      {/* ── Top app bar ── */}
      <header className="sw-appbar">
        <Brand />
        <div className="sw-appbar-right">
          {profile.staffRole && (
            <Badge aria-label={`Your role: ${profile.staffRole}`}>
              {profile.staffRole}
            </Badge>
          )}
          <div className="sw-account-wrap" ref={accountRef}>
            <Button
              variant="light"
              className="sw-avatar-btn"
              aria-label="Open account menu"
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              onClick={() => setAccountOpen((v) => !v)}
            >
              <Avatar initials={initials || "S"} />
            </Button>
            {accountOpen && (
              <div className="sw-account-menu" role="menu" aria-label="Account actions">
                <div className="sw-account-info">
                  <span className="sw-account-name">{name}</span>
                  <span className="sw-account-email">{profile.email}</span>
                </div>
                <div className="sw-account-divider" />
                <Button
                  variant="light"
                  className="sw-account-item"
                  role="menuitem"
                  onClick={onSignOut}
                >
                  <Icon name="arrow" size={15} />
                  Sign out
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="sw-content" id="sw-main" tabIndex={-1}>
        {tab === "events" && <UpcomingEventsPage displayName={name} />}
        {tab === "checklist" && coordinator && <EventChecklistPage />}
        {tab === "checklist" && !coordinator && (
          <div className="sw-access-denied">
            <Icon name="alert" size={36} />
            <h2>Coordinator access required</h2>
            <p>
              The event checklist is only available to the assigned coordinator.
              Contact your administrator if you believe this is an error.
            </p>
          </div>
        )}
      </main>

      {/* ── Bottom navigation bar ── */}
      <nav className="sw-bottom-nav" aria-label="Staff workspace navigation">
        <Button
          variant="light"
          className={`sw-nav-item ${tab === "events" ? "sw-nav-active" : ""}`}
          onClick={() => setTab("events")}
          aria-current={tab === "events" ? "page" : undefined}
        >
          <Icon name="calendar" size={22} />
          <span>Events</span>
        </Button>

        {coordinator && (
          <Button
            variant="light"
            className={`sw-nav-item ${tab === "checklist" ? "sw-nav-active" : ""}`}
            onClick={() => setTab("checklist")}
            aria-current={tab === "checklist" ? "page" : undefined}
          >
            <Icon name="clipboard" size={22} />
            <span>Checklist</span>
          </Button>
        )}
      </nav>
    </div>
  )
}
