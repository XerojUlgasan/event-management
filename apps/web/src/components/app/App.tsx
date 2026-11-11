import { useEffect } from "react"
import { Brand, Button } from "@event-management/ui"

import { AuthProvider, useAuth } from "../../lib/auth"
import { AppShell } from "./AppShell"
import { AuthPage } from "./AuthPage"
import { CustomerDashboard } from "./customer/CustomerDashboard"
import { StaffWorkspaceShell } from "./staff/StaffWorkspaceShell"
import { adminBookingRequestId, adminKey, allowedWorkspacePath, appHome, isStaffWorkspace, isSystemAdmin, normalizePath, workspaceReturnPath } from "./routes"

export default function App({ initialPath, initialSearch }: { initialPath: string; initialSearch: string }) {
  return (
    <AuthProvider>
      <Workspace path={normalizePath(initialPath)} search={initialSearch} />
    </AuthProvider>
  )
}

function Workspace({ path, search }: { path: string; search: string }) {
  const { status, profile, signOut } = useAuth()
  const mode = new URLSearchParams(search).get("mode") === "register" ? "register" : "signin"

  useEffect(() => {
    if (status !== "signed-in" || !profile) return
    const home = appHome(profile)
    const params = new URLSearchParams(search)
    const book = params.get("book")
    const resume = params.get("booking") === "resume"
    if (path === "/login") {
      if (profile.role === "customer" && (book || resume)) {
        const next = new URLSearchParams()
        if (book) next.set("book", book)
        if (resume) next.set("booking", "resume")
        window.location.replace(`/app/home?${next}`)
      } else window.location.replace(workspaceReturnPath(profile, params.get("next")) ?? home)
      return
    }
    if (path === "/app" || !allowedWorkspacePath(profile, path)) window.location.replace(home)
  }, [status, profile, path, search])

  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.assign("/login")
    } catch {
      // Keep the current account visible until the API confirms logout.
    }
  }

  if (status === "loading") {
    return (
      <div className="auth-splash">
        <Brand />
        <span>Loading your workspace…</span>
      </div>
    )
  }

  if (status !== "signed-in" || !profile) {
    if (path !== "/login") {
      const next = `${path}${search}`
      window.location.replace(`/login?next=${encodeURIComponent(next)}`)
      return (
        <div className="auth-splash">
          <Brand />
          <span>Loading your workspace…</span>
        </div>
      )
    }
    return <AuthPage initialMode={mode} onBack={() => { window.location.assign("/") }} />
  }

  if (path === "/login" || path === "/app" || !allowedWorkspacePath(profile, path)) {
    return (
      <div className="auth-splash">
        <Brand />
        <span>Loading your workspace…</span>
      </div>
    )
  }

  if (isStaffWorkspace(profile)) {
    if (profile.role !== "staff") {
      return (
        <main className="auth-splash">
          <Brand />
          <h1>Staff access required</h1>
          <p>Ask a System Administrator to review your account role before using event staffing.</p>
          <Button onClick={handleSignOut}>Sign out</Button>
        </main>
      )
    }
    return <StaffWorkspaceShell profile={profile} path={path} onSignOut={handleSignOut} />
  }
  if (isSystemAdmin(profile)) {
    const active = adminKey(path)
    return active ? <AppShell profile={profile} active={active} bookingRequestId={adminBookingRequestId(path) ?? undefined} onSignOut={handleSignOut} /> : null
  }
  return (
    <CustomerDashboard
      path={path}
      search={search}
      onPublic={() => { window.location.assign("/") }}
      userName={profile.displayName ?? profile.email}
      userEmail={profile.email}
      onSignOut={handleSignOut}
    />
  )
}
