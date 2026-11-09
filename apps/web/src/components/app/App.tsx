import { useEffect } from "react"
import { Brand } from "@event-management/ui"

import { AuthProvider, useAuth } from "../../lib/auth"
import { AppShell } from "./AppShell"
import { AuthPage } from "./AuthPage"
import { CustomerDashboard } from "./customer/CustomerDashboard"
import { StaffWorkspaceShell } from "./staff/StaffWorkspaceShell"
import { adminKey, appHome, customerPaths, isStaffWorkspace, isSystemAdmin, normalizePath } from "./routes"

function isCoordinator(staffRole: string | null) {
  if (!staffRole) return false
  const role = staffRole.toLowerCase()
  return role.includes("coordinator") || role.includes("head waiter")
}

function allowedPath(profile: { role: string; staffRole: string | null }, path: string) {
  if (profile.role === "customer") return (Object.values(customerPaths) as string[]).includes(path)
  if (isStaffWorkspace(profile)) {
    if (path === "/app/events") return true
    return path === "/app/checklist" && isCoordinator(profile.staffRole)
  }
  return adminKey(path) !== null
}

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
      } else window.location.replace(home)
      return
    }
    if (path === "/app" || !allowedPath(profile, path)) window.location.replace(home)
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

  if (path === "/login" || path === "/app" || !allowedPath(profile, path)) {
    return (
      <div className="auth-splash">
        <Brand />
        <span>Loading your workspace…</span>
      </div>
    )
  }

  if (isStaffWorkspace(profile)) return <StaffWorkspaceShell profile={profile} path={path} onSignOut={handleSignOut} />
  if (isSystemAdmin(profile)) {
    const active = adminKey(path)
    return active ? <AppShell profile={profile} active={active} onSignOut={handleSignOut} /> : null
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
