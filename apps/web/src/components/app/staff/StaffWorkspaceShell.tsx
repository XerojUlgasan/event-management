import { useState, useRef, useEffect } from "react"
import { Avatar, Badge, Brand, Button, Icon } from "@event-management/ui"
import { StaffEventDays } from "./StaffEventDays"

type StaffTab = "events" | "assignments"

export function StaffWorkspaceShell({
  profile,
  path,
  onSignOut,
}: {
  profile: {
    displayName: string | null
    email: string
    staffRole: string | null
  }
  path: string
  onSignOut: () => void
}) {
  const tab: StaffTab = path === "/app/assignments" ? "assignments" : "events"
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
        <StaffEventDays assignments={tab === "assignments"} />
      </main>

      {/* ── Bottom navigation bar ── */}
      <nav className="sw-bottom-nav" aria-label="Staff workspace navigation">
        <Button
          variant="light"
          className={`sw-nav-item ${tab === "events" ? "sw-nav-active" : ""}`}
          onClick={() => { window.location.assign("/app/events") }}
          aria-current={tab === "events" ? "page" : undefined}
        >
          <Icon name="calendar" size={22} />
          <span>Event days</span>
        </Button>

        <Button variant="light" className={`sw-nav-item ${tab === "assignments" ? "sw-nav-active" : ""}`} onClick={() => { window.location.assign("/app/assignments") }} aria-current={tab === "assignments" ? "page" : undefined}>
          <Icon name="clipboard" size={22} /><span>Assigned to me</span>
        </Button>
      </nav>
    </div>
  )
}
