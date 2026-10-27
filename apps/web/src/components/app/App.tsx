import { useEffect, useState } from "react"
import { Brand } from "@event-management/ui"

import { AuthProvider, useAuth } from "../../lib/auth"
import { packages } from "./data"
import type { EditablePackage } from "./data"
import type { View } from "./types"
import { AppShell } from "./AppShell"
import { AuthPage } from "./AuthPage"
import { CustomerDashboard } from "./customer/CustomerDashboard"
import { PublicSite } from "./PublicSite"

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

function AppContent() {
  const { status, profile, signOut } = useAuth()
  const [view, setView] = useState<View>("public")
  const [sharedPackages, setSharedPackages] = useState<EditablePackage[]>(
    packages.map((item, index) => ({
      ...item,
      inclusions:
        index === 0
          ? "Event coordination, venue setup, signature menu, service team"
          : "Planning guide, styled setup, selected menu, event support",
      status: index === 2 ? "Draft" : "Published",
    })),
  )

  useEffect(() => {
    if (status === "signed-in" && profile) {
      setView(profile.role === "admin" ? "app" : "customer")
    }
  }, [status, profile])

  const handleSignOut = async () => {
    try {
      await signOut()
      setView("login")
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

  if (status === "signed-in" && profile) {
    const displayName = profile.displayName ?? profile.email

    if (view === "login" || view === "app" || view === "customer") {
      if (profile.role === "admin") {
        return (
          <AppShell
            onPublic={() => setView("public")}
            profile={profile}
            onSignOut={handleSignOut}
            packageRows={sharedPackages}
            setPackageRows={setSharedPackages}
          />
        )
      }

      return (
        <CustomerDashboard
          onPublic={() => setView("public")}
          userName={displayName}
          userEmail={profile.email}
          onSignOut={handleSignOut}
          packageRows={sharedPackages}
        />
      )
    }
  }

  if (view === "login" || view === "app" || view === "customer") {
    return <AuthPage onBack={() => setView("public")} />
  }

  return <PublicSite onEnterCustomer={() => setView("login")} />
}
